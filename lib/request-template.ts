// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

/////////////////////////////////////////////////////////////////////
/// Interfaces and classes for request template support in Winery.js

import * as assert from 'assert';
import * as path from 'path';

import * as utils from './utils';

import { Application } from './application';
import { 
    ScopedObjectContextDef, 
    ScopedObjectContext, 
    TypeDef, 
    ProviderDef, 
    NamedObjectDef 
} from './object-model';

import * as fs from 'fs';

/// <summary> Request template definition. </summary>
export interface RequestTemplateDef {
    /// <summary> Uri of base template to inherit from. </summary>
    /// This is required if property 'application' is not present.
    /// </summary>
    base?: string;

    /// <summary> Application instance name this template applies to. 
    /// This is required if property 'base' is not present.
    /// </summary>
    application?: string;

    /// <summary> Definition of overridden types </summary>
    overrideTypes?: TypeDef[];

    /// <summary> Definition of overridden providers </summary>
    overrideProviders?: ProviderDef[];

    /// <summary> Definition of overridden named objects </summary>
    overrideObjects?: NamedObjectDef[];
}

/// <summary> Request template. </summary>
export class RequestTemplate {
    /// <summary> Uri of this template. </summary>
    private _uri: string;

    /// <summary> Request-template level object context. </summary>
    private _objectContext: ScopedObjectContext;

    /// <summary> Application to which this template applies. </summary>
    private _app: Application;

    /// <summary> Base template. </summary>
    private _base: RequestTemplate;
    
    /// <summary> Constructor. </summary>
    public constructor(
        uri: string,
        app: Application,
        base: RequestTemplate,
        def: RequestTemplateDef) {

        assert(uri != null);
        assert(app != null);

        this._uri = uri;
        this._app = app;
        this._base = base;

        // Create request-template level object context.
        let parentContext: ScopedObjectContext = 
            base != null ? base.objectContext : app.objectContext;

        let contextDef = new ScopedObjectContextDef(
                parentContext.def,
                def.overrideTypes,
                def.overrideProviders,
                def.overrideObjects,
                true
            );

        this._objectContext = new ScopedObjectContext(
                `template:${uri}`,
                app.objectContext.baseDir,       // We always use application base dir to resolve paths in request template definition.
                parentContext,
                contextDef
            );
    }

    /// <summary> Get Uri of this request template. </summary>
    public get uri(): string {
        return this._uri;
    }

    /// <summary> Get application to which this template applies. </summary>
    public get application(): Application {
        return this._app;
    }

    /// <summary> Get base template. </summary>
    public get base(): RequestTemplate {
        return this._base;
    }

    /// <summary> Get template-level object context. </summary>
    public get objectContext() : ScopedObjectContext {
        return this._objectContext;
    }
}

/// <summary> Interface for RequestTemplate loader by ID. </summary>
export interface RequestTemplateLoader {
    /// <summary> Load a request template by uri.
    /// It will try to get a base by baseTemplateGetter first, and load the base recursively if not found. 
    /// </summary>
    load(uri: string, 
        applicationGetter: (app: string) => Application,
        baseTemplateGetter: (uri: string) => RequestTemplate): RequestTemplate;

    /// <summary> Get applied application name of a template URI without loading it. </summary>
    getApplicationName(uri: string): string;
}

/// <summary> Loader for file based request template. </summary>
export class RequestTemplateFileLoader {
    /// <summary> JSON schema used to validate config. </summary>
    private static readonly REQUEST_TEMPLATE_SCHEMA: utils.JsonSchema 
        = new utils.JsonSchema(path.resolve(__dirname, "../schema/request-template.schema.json"));

    public load(uri: string, 
        appGetter: (app: string) => Application,
        baseTemplateGetter: (baseUri: string) => RequestTemplate) : RequestTemplate {

        let seenUris: { [uri: string]: boolean} = {};
        return this.loadInternal(uri, appGetter, baseTemplateGetter, seenUris);
    }

    private loadInternal(uri: string, 
        appGetter: (app: string) => Application,
        baseTemplateGetter: (baseUri: string) => RequestTemplate,
        seenUris: {[uri: string] : boolean}) : RequestTemplate {

        let lcUri = uri.toLowerCase();
        if (seenUris[lcUri] != null) {
            throw new Error(`Circle found in template inheritance. Uri: "${uri}"`);
        }
        seenUris[lcUri] = true;

        let def = <RequestTemplateDef>utils.readConfig(uri, RequestTemplateFileLoader.REQUEST_TEMPLATE_SCHEMA);
        let baseDir = path.dirname(uri);

        let base: RequestTemplate = undefined;
        let app: Application = undefined;
        if (def.base != null) {
            base = this.loadInternal(
                path.resolve(baseDir, def.base), 
                appGetter, 
                baseTemplateGetter, 
                seenUris);

            app = base.application;
        }
        else {
            if (def.application == null) {
                throw new Error(`Property "application" or "base" must be present in Request Template definition.`);
            }
            app = appGetter(def.application);
            if (app == null) {
                throw new Error(`Application "${def.application}" is not registered in current host.`);
            }
        }
        return new RequestTemplate(uri, app, base, def);
    }

    public getApplicationName(uri: string): string {
        let def = <RequestTemplateDef>utils.readConfig(uri, 
            RequestTemplateFileLoader.REQUEST_TEMPLATE_SCHEMA);

        if (def["base"] != null) {
            
            return this.getApplicationName(
                path.resolve(path.dirname(uri), def.base));
        }
        else {
            assert(def.application != null);
            return def.application;
        }
    }
}

/// <summary> Request template reference. </summary>
class RequestTemplateReference {
    public template: RequestTemplate;
    public refCount: number;

    constructor(template: RequestTemplate, refCount: number) {
        this.template = template;
        this.refCount = refCount;
    }
}

/// <summary> Request template manager. </summary>
export class RequestTemplateManager {
    private _loader: RequestTemplateLoader;
    private _appGetter: (name: string) => Application;
    private _cache: Map<string, RequestTemplateReference> = new Map<string, RequestTemplateReference>();

    /// <summary> Constructor. </summary>
    public constructor(loader: RequestTemplateLoader,
        appGetter: (name: string) => Application) {
        this._loader = loader;
        this._appGetter = appGetter;
    }

    /// <summary> Get a pre-loaded request template by ID. </summary>
    public get(uri: string): RequestTemplate {
        if (this._cache.has(uri)) {
            return this._cache.get(uri).template;
        }
        return undefined;
    }

    /// <summary> Load a request template by ID, and insert it into cache. </summary>
    private load(uri: string) : RequestTemplate {
        let thisTemplate = this._loader.load(
            uri, 
            this._appGetter,
            (baseUri: string): RequestTemplate => {
                return this.get(baseUri);
            });

        // Cache entire chain from current to top-most base using reference counting.
        let t = thisTemplate;
        while (t != null) {
            let uri = t.uri;
            if (this._cache.has(uri)) {
                let ref = this._cache.get(uri);
                ref.refCount++;
            } else {
                this._cache.set(uri, new RequestTemplateReference(t, 1));
            }
            t = t.base;
        }
        return thisTemplate;
    }

    /// <summary> Get a pre-loaded request template or load it and return. </summary>
    public getOrLoad(uri: string): RequestTemplate {
        let t = this.get(uri);
        if (t == null) {
            return this.load(uri);
        }
        return t;
    }

    /// <summary> Unload a pre-loaded request template. </summary>
    public unload(uri: string): void {
        if (!this._cache.has(uri)) {
            return;
        }
        // Decrease reference entire chain from current to top-most base.
        // Unload if no further reference.
        while (true) {
            assert(this._cache.has(uri));
            let r = this._cache.get(uri);

            if (--r.refCount == 0) {
                this._cache.delete(uri);
            }
            if (r.template.base == null) {
                break;
            }
            uri = r.template.base.uri;
        }
    }

    /// <summary> Return loaded templates. </summary>
    public get loadedTemplates(): string[] {
        let uris: string[] = [];
        this._cache.forEach((r: RequestTemplateReference, uri: string) => {
            uris.push(uri);
        });
        return uris;
    }
}