// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as napa from 'napajs';
import * as path from 'path';
import * as assert from 'assert';

import { Request } from './request';
import { Response, ResponseHelper} from './response';
import { Settings, Application, RequestContext} from './application';
import { RequestTemplate, RequestTemplateManager, RequestTemplateFileLoader, RequestTemplateLoader} from './request-template';

import * as objectContext from './object-context';
import * as config from './config';
import * as utils from './utils';

/// <summary> Host config, which is the root config of winery. </summary>
export interface HostSettings extends Settings{
    /// <summary> Throw exception on error, or return Response with error code. Default is true. </summary>
    throwExceptionOnError: boolean;
}

/// <summary> Interface for application host. </summary>
export interface Host {
    /// <summary> Register an application instance in current host. </summary>
    /// <param name="appModulePath"> full module path of a winery application.</param>
    /// <param name="appInstanceNames"> a list of strings used as names of application instances.</param>
    /// <param name="zone"> zone to run the app. If undefined, use current isolate. </param>
    register(appModulePath: string, appInstanceNames: string[], zone?: napa.zone.Zone): Promise<void>;

    /// <summary> Serve a request. </summary>
    /// <param name="request"> A JSON string or a request object. </param>
    serve(request: string | Request): Promise<Response>;

    /// <summary> Get application instance names served by this host. </param>
    applicationInstanceNames: string[];
}

/// <summary> A concrete Host on a leaf JavaScript worker . </summary>
export class Leaf implements Host{
    // Lower-case name to application map.
    private _applications: Map<string, Application> = new Map<string, Application>();

    // Request template manager.
    private _requestTemplateManager: RequestTemplateManager;

    // Enabled application names. 
    private _applicationInstanceNames: string[] = [];

    // Host settings.
    private _settings: HostSettings;

    // Global scope object context.
    private _objectContext: objectContext.ScopedObjectContext;

    /// <summary> Constructor. </summary>
    /// <param> winery host settings. </summary>
    public constructor(settings: HostSettings = null) {
        this._settings = settings;
        this._objectContext = new objectContext.ScopedObjectContext(
            "global",
            this._settings.baseDir,
            null,
            settings.objectContextDef
        );

        this._requestTemplateManager = new RequestTemplateManager(
            new RequestTemplateFileLoader(),
            (name: string): Application => {
                return this._applications.get(name.toLowerCase());
            }
        )
    }

    /// <summary> Register an application instance in current host. </summary>
    /// <param name="appModulePath"> full module path of a winery application.</param>
    /// <param name="appInstanceNames"> a list of strings used as names of application instances.</param>
    /// <param name="zone"> zone to run the app. If undefined, use current isolate. </param>
    public register(
        appModulePath: string, 
        appInstanceNames: string[], 
        zone?: napa.zone.Zone): Promise<void> {

        if (zone != null) {
            return Promise.reject("LeafHost doesn't support register on a remote Zone.");
        }

        // Load application.
        let appConfigPath = require.resolve(appModulePath + '/app.json');
        let app = new Application(
                this._objectContext,
                config.ApplicationConfig.fromConfig(
                this._settings,
                appConfigPath));

        // If any instance name has already been registered, fail the whole register operation.
        for (let instanceName of appInstanceNames) {
            let lowerCaseName = instanceName.toLowerCase();
            if (this._applications.has(lowerCaseName)) {
                return Promise.reject(`Already registered with application name: '${instanceName}'.`);
            }
        }

        // Put application in registry.
        for (let instanceName of appInstanceNames) {
            let lowerCaseName = instanceName.toLowerCase();
            this._applications.set(lowerCaseName, app);
            this._applicationInstanceNames.push(instanceName);
        }

        return Promise.resolve();
    }

    /// <summary> Serve a request. </summary>
    /// <param name="request"> A JSON string or a request object. </param>
    public serve(request: string | Request): Promise<Response> {
        return new Promise<RequestContext>(resolve => {
            if (typeof request === 'string') {
                request = utils.appendMessageOnException(
                    ". Fail to parse request string.",
                    () => { return JSON.parse(<string>request);});
            }

            // Lookup base template and application.
            let base: RequestTemplate = undefined;
            if ((<Request>request).base != null) {
                base = this._requestTemplateManager.getOrLoad((<Request>request).base);
            } else {
                let appName = (<Request>request).application;
                if (appName == null) {
                    throw new Error("Either 'application' or 'base' should be present in request.");
                }
                let app = this.getApplication(appName);
                base = app.defaultRequestTemplate;
            }
            resolve(new RequestContext(base, <Request>request));
        }).then((context: RequestContext) => {
            return context.execute();
        });
    }

    /// <summary> Get application names. </summary>
    public get applicationInstanceNames(): string[] {
        return this._applicationInstanceNames;
    }

    /// <summary> Get host level object context. </summary>
    public get objectContext(): objectContext.ScopedObjectContext {
        return this._objectContext;
    }

    /// <summary> Get application by name. </summary>
    public getApplication(appName: string): Application {
        let loweredName = appName.toLowerCase();
        if (this._applications.has(loweredName)) {
            return this._applications.get(loweredName);
        }
        throw new Error("'" + appName + "' is not a known application");
    }

    /// <summary> Get global settings. </summary>
    public get settings(): Settings {
        return this._settings;
    }
}

/// <summary> Host proxy to talk to another JavaScript worker. </summary>
export class Proxy implements Host {

    /// <summary> Zone to run the app. </summary>
    private _zone: napa.zone.Zone;

    /// <summary> Application instance names running on this host. </summary>
    private _applicationInstanceNames: string[] = [];

    /// <summary> Constructor. </summary>
    public constructor(zone: napa.zone.Zone) {
        assert(zone != null);
        this._zone = zone;
    }

    /// <summary> Register an application instance in current host. </summary>
    /// <param name="appModulePath"> full module path of a winery application.</param>
    /// <param name="appInstanceNames"> a list of strings used as names of application instances.</param>
    /// <param name="zone"> zone to run the app. If absent, use current isolate. </param>
    public register(appModulePath: string, 
        appInstanceNames: string[], 
        zone?: napa.zone.Zone): Promise<void> {
        if (zone != null && zone != this._zone) {
            return Promise.reject("HostProxy cannot register application for a different zone.");
        }

        return this._zone.broadcast((baseDir: string, appModulePath: string, instanceNames: string[]) => {
                require(baseDir + '/index').hub().register(appModulePath, instanceNames);
            }, [__dirname, appModulePath, appInstanceNames])
            .then(() => {
                this._applicationInstanceNames = this._applicationInstanceNames.concat(appInstanceNames);
            });
    }

    /// <summary> Serve a request. </summary>
    /// <param name="request"> A JSON string or a request object. </param>
    public async serve(request: string | Request): Promise<Response> {
        let zone = this._zone;
        return zone.execute((request: string | Request): Response => {
                return require(__dirname + '/index').hub().serve(request);
            }, [request])
            .then((result: napa.zone.Result) => {
                return Promise.resolve(ResponseHelper.parse(result.payload));
            });
    }

    /// <summary> Get application instance names served by this host. </param>
    public get applicationInstanceNames(): string[] {
        return this._applicationInstanceNames;
    }
}

/// <summary> Host hub. (this can only exist in Node.JS isolate) </summary>
export class Hub implements Host {
    /// <summary> Local host. Only instantiate when application is registered locally. </summary>
    private _localHost: Host;

    /// <summary> Zone to remote host map. </summary>
    private _proxies: Map<napa.zone.Zone, Host> = new Map<napa.zone.Zone, Host>();

    /// <summary> Settings for local host if needed. </summary>
    private _settings: HostSettings;

    /// <summary> Application instance names. </summary>
    private _applicationInstanceNames: string[] = [];

    /// <summary> Application instance name to host map. </summary>
    private _hostMap: Map<string, Host> = new Map<string, Host>();

    /// <summary> Template loader to figure out application name of a template. </summary>
    private _templateLoader: RequestTemplateLoader = new RequestTemplateFileLoader();

    /// <summary> Template uri to application name map. </summary>
    private _templateToAppNameMap : Map<string, string> = new Map<string, string>();

    /// <summary> Constructor. </summary>
    /// <param> winery host settings. </summary>
    public constructor(settings: HostSettings = null) {
        this._settings = settings;
    }

    /// <summary> Register an application for serving. </summary>
    /// <param name="appModuleName"> module name of a winery application.</param>
    /// <param name="appInstanceNames"> a list of strings used as application instance names</param>
    /// <param name="zone"> zone to run the app. If absent, use current isolate. </param>
    public register(appModuleName: string, appInstanceNames: string[], zone?: napa.zone.Zone) : Promise<void> {
        // If module is in relative path, figure out the full path from caller directory name.
        if (appModuleName.startsWith('.')) {
            let callSites = napa.v8.currentStack(2);
            if (callSites.length > 1) {
                appModuleName = path.resolve(path.dirname(callSites[1].getFileName()), appModuleName);
            }
        }
        let appModulePath: string = path.dirname(require.resolve(appModuleName + '/app.json'));

        // Get or create host associated to zone.
        let host: Host = this.findOrCreateHost(zone);
        
        return host.register(appModulePath, appInstanceNames, undefined).then(() => {
            this._applicationInstanceNames = this._applicationInstanceNames.concat(appInstanceNames);
            for (let instanceName of appInstanceNames) {
                let lowerCaseName = instanceName.toLowerCase();
                this._hostMap.set(lowerCaseName, host);
            }
        });
    }

    /// <summary> Find or create host for a zone. </summary>
    private findOrCreateHost(zone: napa.zone.Zone): Host {
        if (zone == null) {
            if (this._localHost == null) {
                this._localHost = new Leaf(this._settings);
            }
            return this._localHost;
        }
        else {
            if (this._proxies.has(zone)) {
                return this._proxies.get(zone);
            }
            else {
                let host = new Proxy(zone);
                this._proxies.set(zone, host);
                return host;
            }
        }
    }

    /// <summary> Serve winery request. </summary>
    public async serve(request: string | Request): Promise<Response> {
        return new Promise<Host>(resolve => {
            if (typeof request === 'string') {
                request = utils.appendMessageOnException(
                    ". Fail to parse request string.",
                    () => { return JSON.parse(<string>request);});
            }

            // TODO: @daiyip, avoid extra parsing/serialization for host proxy.
            let appName = (<Request>request).application;
            if (appName == null) {
                let baseUri = (<Request>request).base;
                if (baseUri == null) {
                    throw new Error("Either 'application' or 'base' should be present in request.");
                }
                let lcUri = baseUri.toLowerCase();
                if (this._templateToAppNameMap.has(lcUri)) {
                    appName = this._templateToAppNameMap.get(lcUri);
                } else {
                    appName = this._templateLoader.getApplicationName(baseUri);
                    this._templateToAppNameMap.set(lcUri, appName);
                }
            }

            let lowerCaseName = appName.toLowerCase();
            if (!this._hostMap.has(lowerCaseName)) {
                throw new Error("Application '" + appName + "' is not registered for serving");
            }
            
            resolve(this._hostMap.get(lowerCaseName));
        }).then((host: Host) => {
            return host.serve(request);
        });
    }

    /// <summary> Get application instance names. </summary>
    public get applicationInstanceNames(): string[] {
        return this._applicationInstanceNames;
    }
}

