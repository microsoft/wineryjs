import * as napa from 'napajs';
import * as path from 'path';
import * as assert from 'assert';

import { Settings, Application, RequestContext} from './app';
import * as objectContext from './object-context';
import * as wire from './wire';
import * as config from './config';
import * as utils from './utils';

/// <summary> Engine config, which is the root config of winery. </summary>
export interface EngineSettings extends Settings{
    /// <summary> Throw exception on error, or return Response with error code. Default is true. </summary>
    throwExceptionOnError: boolean;
}

/// <summary> Interface for application engine. </summary>
export interface Engine {
    /// <summary> Register an application instance in current engine. </summary>
    /// <param name="appModulePath"> full module path of a winery application.</param>
    /// <param name="appInstanceNames"> a list of strings used as names of application instances.</param>
    /// <param name="zone"> zone to run the app. If undefined, use current isolate. </param>
    register(appModulePath: string, appInstanceNames: string[], zone: napa.zone.Zone): Promise<void>;

    /// <summary> Serve a request. </summary>
    /// <param name="request"> A JSON string or a request object. </param>
    serve(request: string | wire.Request): Promise<wire.Response>;

    /// <summary> Get application instance names served by this engine. </param>
    applicationInstanceNames: string[];
}

/// <summary> Engine on a leaf JavaScript worker . </summary>
export class LeafEngine implements Engine{
    // Lower-case name to application map.
    private _applications: Map<string, Application> = new Map<string, Application>();

    // Enabled application names. 
    private _applicationInstanceNames: string[] = [];

    // Engine settings.
    private _settings: EngineSettings;

    // Global scope object context.
    private _objectContext: objectContext.ScopedObjectContext;

    /// <summary> Constructor. </summary>
    /// <param> winery engine settings. </summary>
    public constructor(settings: EngineSettings = null) {
        this._settings = settings;
        this._objectContext = new objectContext.ScopedObjectContext(
            "global",
            this._settings.baseDir,
            null,
            settings.objectContext
        );
    }

    /// <summary> Register an application instance in current engine. </summary>
    /// <param name="appModulePath"> full module path of a winery application.</param>
    /// <param name="appInstanceNames"> a list of strings used as names of application instances.</param>
    /// <param name="zone"> zone to run the app. If undefined, use current isolate. </param>
    public register(
        appModulePath: string, 
        appInstanceNames: string[], 
        zone: napa.zone.Zone = null): Promise<void> {

        if (zone != null) {
            return Promise.reject("LeafEngine doesn't support register on a remote Zone.");
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
    public serve(request: string | wire.Request): Promise<wire.Response> {
        return new Promise<RequestContext>(resolve => {
            if (typeof request === 'string') {
                request = utils.appendMessageOnException(
                    ". Fail to parse request string.",
                    () => { return JSON.parse(<string>request);});
            }
            
            let appName = (<wire.Request>request).application;
            if (appName == null) {
                throw new Error("Property 'application' is missing from request.");
            }

            resolve(new RequestContext(
                this.getApplication(appName), 
                <wire.Request>request));
        }).then((context: RequestContext) => {
            return context.execute();
        });
    }

    /// <summary> Get application names. </summary>
    public get applicationInstanceNames(): string[] {
        return this._applicationInstanceNames;
    }

    /// <summary> Get engine level object context. </summary>
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

/// <summary> Engine proxy to talk to another JavaScript worker. </summary>
export class EngineProxy {
    /// <summary> Zone to run the app </summary>
    private _zone: napa.zone.Zone;

    /// <summary> Application instance names running on this engine. </summary>
    private _applicationInstanceNames: string[] = [];

    /// <summary> Constructor. </summary>
    public constructor(zone: napa.zone.Zone) {
        assert(zone != null);
        this._zone = zone;
    }

    /// <summary> Register an application instance in current engine. </summary>
    /// <param name="appModulePath"> full module path of a winery application.</param>
    /// <param name="appInstanceNames"> a list of strings used as names of application instances.</param>
    /// <param name="zone"> zone to run the app. If undefined, use current isolate. </param>
    public register(appModulePath: string, 
        appInstanceNames: string[], 
        zone: napa.zone.Zone = undefined): Promise<void> {
        if (zone != null && zone != this._zone) {
            return Promise.reject("EngineProxy cannot register application for a different zone.");
        }

        let instanceString: string = "";
        for (let i = 0; i < appInstanceNames.length; ++i) {
            if (i > 0) {
                instanceString += ', ';
            }
            instanceString += `"${appInstanceNames[i]}"`;
        }
        let setupCode = `
            var win = require("${__dirname.replace(/[\\]/g, "/")}/index");
            win.register("${appModulePath.replace(/[\\]/g, "/")}", [${instanceString}])
                .catch(e => console(e));
            `;

        return this._zone.broadcast(setupCode).then(() => {
            this._applicationInstanceNames.concat(appInstanceNames);
        });
    }

    /// <summary> Serve a request. </summary>
    /// <param name="request"> A JSON string or a request object. </param>
    public async serve(request: string | wire.Request): Promise<wire.Response> {
        let zone = this._zone;
        return zone.execute('', 'win.serve', [request])
            .then((result: napa.zone.Result) => {
                return Promise.resolve(wire.ResponseHelper.parse(result.payload));
            });
    }

    /// <summary> Get application instance names served by this engine. </param>
    public get applicationInstanceNames(): string[] {
        return this._applicationInstanceNames;
    }
}

/// <summary> Engine hub. (this can only exist in Node.JS isolate) </summary>
export class EngineHub implements Engine {
    /// <summary> Local engine. Only instantiate when application is registered locally. </summary>
    private _localEngine: Engine;

    /// <summary> Zone to remote engine map. </summary>
    private _proxies: Map<napa.zone.Zone, Engine> = new Map<napa.zone.Zone, Engine>();

    /// <summary> Settings for local engine if needed. </summary>
    private _settings: EngineSettings;

    /// <summary> Application instance names. </summary>
    private _applicationInstanceNames: string[] = [];

    /// <summary> Application instance name to engine map. </summary>
    private _engineMap: Map<string, Engine> = new Map<string, Engine>();

    /// <summary> Constructor. </summary>
    /// <param> winery engine settings. </summary>
    public constructor(settings: EngineSettings = null) {
        this._settings = settings;
    }

    /// <summary> Register an application for serving. </summary>
    /// <param name="appModulePath"> full module path of a winery application.</param>
    /// <param name="appInstanceNames"> a list of strings used as application instance names</param>
    /// <param name="zone"> zone to run the app. If null, use current isolate. </param>
    public register(appModulePath: string, appInstanceNames: string[], zone: napa.zone.Zone = undefined) : Promise<void> {
        let engine: Engine = undefined;
        if (zone == null) {
            if (this._localEngine == null) {
                this._localEngine = new LeafEngine(this._settings);
            }
            engine = this._localEngine;
        }
        else {
            if (this._proxies.has(zone)) {
                engine = this._proxies.get(zone);
            }
            else {
                engine = new EngineProxy(zone);
                this._proxies.set(zone, engine);
            }
        }
        return engine.register(appModulePath, appInstanceNames, undefined).then(() => {
            this._applicationInstanceNames = this._applicationInstanceNames.concat(appInstanceNames);
            for (let instanceName of appInstanceNames) {
                let lowerCaseName = instanceName.toLowerCase();
                this._engineMap.set(lowerCaseName, engine);
            }
        });
    }

    /// <summary> Serve winery request. </summary>
    public async serve(request: string | wire.Request): Promise<wire.Response> {
        return new Promise<Engine>(resolve => {
            if (typeof request === 'string') {
                request = utils.appendMessageOnException(
                    ". Fail to parse request string.",
                    () => { return JSON.parse(<string>request);});
            }

            // TODO: @dapeng, avoid extra parsing/serialization for engine proxy.
            let appName = (<wire.Request>request).application;
            if (appName == null) {
                throw new Error("Property 'application' is missing from request.");
            }

            let lowerCaseName = appName.toLowerCase();
            if (!this._engineMap.has(lowerCaseName)) {
                throw new Error("Application '" + appName + "' is not registered for serving");
            }
            
            resolve(this._engineMap.get(lowerCaseName));
        }).then((engine: Engine) => {
            return engine.serve(request);
        });
    }

    /// <summary> Get application instance names. </summary>
    public get applicationInstanceNames(): string[] {
        return this._applicationInstanceNames;
    }
}

