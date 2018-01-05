//////////////////////////////////////////////////////////////////////////////////////////////////////////////
// This file contains application definition for winery.
//
// Each application sub-directory starts with an 'app.json', which is the root JSON file of this application. 
// The 'app.json' declares several aspects of an application, described by './schema/application-config.schema.json'. 
//
// Commonly defined aspects of an application are:
// 1) Object model - Facilitating object creation, provisioning, overriding and retrieval within application functions.
//    a. 'objectTypes': Define constructor of object types supported in current application.
//    b. 'objectProviders': Define URI based object providers in current applicaton.
//                          On provide() implementation, you can use two inputs, one is IObjectWithType and the other
//                          is IObjectWithType array. When you use an array as input, all items must be the same type.
//    c. 'namedObjects': Define objects that can be retrieved by global name in current application. 
//                       Like entry points of application, parameters etc.
//                       On construct() implementation, you have two input options, Uri or Uri array.
// 
//    In 'app.json' Each of these elements can include multiple separate JSON files, which enables sharing on 
//    common definitions across multiple applications. Overriding between multiple JSON files are also supported, 
//    an 'override' property needs to be set to true if we want to override an definition from entries 
//    in latter file against former ones. 
//
//    Common types and named objects are provided. Common types are "Function", "EntryPoint". "NamedObjectRef". 
//    And common named objects are shared commands such as "listAllEntryPoints", "listAllNamedObjects", etc.
//
//    All the concepts in object model could be overridden at request time, which enables us to alter system behavior
//    at request level. We can change system parameter by overriding a numeric named object, or experiment some ad-hoc
//    code by overriding a function named object in system. We can also override object constructor and providers to detour 
//    data creation from some hard dependencies to simple local implementations for testing purpose.
//
// 2) Application level resources,such as: 
//    a) Metrics
//    b) Logging
//    c) More.
//
// 3) Application policies, such as 
//    a) Throttle control policy.
//    b) More.
//
// Beyond the JSON definition that makes predefined application capability declarative, if there is any application specific
// properties for an application, application developers can always add properties to their applcation object in "<app-name>\app.ts".
//
// Application object is exposed as a global object, which resides in each V8 isolate and is alive since the application is initialized.
// Developers can retrieve a specific application by name via Application.getApplication(name) 
// or current application from RequestContext.getApplication().


// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

// External dependencies.
import * as path from 'path';
import * as assert from 'assert';

// internal dependencies.
import * as utils from './utils';

import { 
    NamedObjectDef,
    NamedObject,
    NamedObjectConfig,
    ScopedObjectContextDef, 
    ScopedObjectContext,
    TypeDef,
    TypeConfig,
    ProviderDef,
    ProviderConfig,
} from './object-model';

import { 
    MetricDef, 
    MetricCollection, 
    MetricConfig, 
    createMetricCollection 
} from './metric';

import { RequestContext } from './request-context';
import { Response } from './response';
import { RequestTemplate } from './request-template';

/////////////////////////////////////////////////////////////////////////////////////////
/// Application for managing all execution stack and required resources.

/// <summary> Interface for global winery settings. </summary>
export interface Settings {
    /// <summary> Allow per-request override. Default is true. </summary>
    allowPerRequestOverride: boolean;

    /// <summary> Global scoped context definition. </summary>
    objectContextDef: ScopedObjectContextDef;

    /// <summary> Default execution stack for all applications. Applications, entrypoints can override. </summary>
    defaultExecutionStack?: string[];

    /// <summary> Base directory to resolve relative paths. </summary>
    baseDir: string;
}

///////////////////////////////////////////////////////////////////////////////
/// Interfaces and classes for Application.

/// <summary> Interface for entrypoint function 
/// Entrypoint is a function that perform application logic.
/// Its return value will be property 'output' of Response. 
/// Entrypoint can be synchronous function or asynchronous functions. 
/// For asynchronous function, always return a Promise.
/// </summary>
export type EntryPoint = (requestContext?: RequestContext, input?: any) => any;


/// <summary> Interface for interceptor 
/// Interceptor is the execution unit of winery, multiple interceptors are stacked in execution,
/// That outer interceptors can short circuit the execution. This pattern is useful to add policy layers.
/// during execution, like throttle control, access control, instrumentation etc.
/// Following diagram depicts how multiple interceptors are organized together into an execution stack.
///
/// Execution stack:
///  +------------------------------------------------------------------------------+
///  | Interceptor 1          Do pre-request work 1                                 |
///  |               +-----------------------------------------------------------+  |
///  |               |  Interceptor 2    Do pre-request work 2                   |  |
///  |               |         +----------------------------------------------+  |  |
///  |               |         |   (More interceptors) ...                    |  |  |
///  |               |         |             +----------------------------+   |  |  |
///  |               |         |             |        Interceptor N       |   |  |  |
///  |               |         |             |     (Entrypoint execution) |   |  |  |
///  |               |         |             +----------------------------+   |  |  |
///  |               |         +----------------------------------------------+  |  |
///  |               |                   Do post-response work 2                 |  |
///  |               +-----------------------------------------------------------+  |
///  |                       Do post-response work 1                                |
///  +------------------------------------------------------------------------------+
///
/// Interceptor can be sync (always return a resolved promise) or async (with unresolved promise).
/// Always implement an interceptor in following patterns: 
/// 1) Do pre-request work (can be optional).
/// 2) call 'let response = await context.continueExecution()' or short circuit.
/// 3) Do post-request work (can be optional). 
/// </summary>
export type Interceptor = (context: RequestContext) => Promise<Response>;

/// <summary> Class for settings of an application </summary>
export interface ApplicationSettings extends Settings {
    /// <summary> ID of application. 
    /// To distinguish from name, which is associated with application instance at runtime by Host.register(),
    /// ID is used for identifying the purpose of application, usually we can put module name as ID.
    /// </summary>
    id: string;

    /// <summary> Description of application. </summary>
    description?: string;

    /// <summary> Definition of metrics in this application. </summary>
    metrics: MetricDef[];
}

/// <summary> Class for Winery application. </summary>
export class Application {
    /// <summary> Application settings. </summary>
    private _settings: ApplicationSettings;

    /// <summary> Per-application object context. </summary>
    private _perAppObjectContext: ScopedObjectContext;

    /// <summary> Default execution stack if not specified per-entrypoint. </summary>
    private _defaultExecutionStack: Interceptor[];

    /// <summary> Default (root) template of this application, which simply pass through application-level context. </summary>
    private _defaultRequestTemplate: RequestTemplate;

    /// <summary> Metric collection. </summary>
    private _metrics: MetricCollection;

    /// <summary> Per-entrypoint execution stack when there is no per-request override. </summary>
    private _perEntryPointExecutionStack: Map<string, Interceptor[]>;

    /// <summary> Construct application from application settings. </summary>
    /// <param name="hostContext"> Host level object context. </summary>
    /// <param name="settings"> Application settings. </summary>
    public constructor(
        hostContext: ScopedObjectContext,
        settings: ApplicationSettings) {
        
        this._settings = settings;
        this._perAppObjectContext = new ScopedObjectContext(
            "./application",
            settings.baseDir,
            hostContext,
            settings.objectContextDef);

        // Create default execution stack.
        this._defaultExecutionStack = [];

        // Prepare default execution stack.
        for (let interceptorName of this._settings.defaultExecutionStack) {
            let interceptor = this.getInterceptor(interceptorName);
            if (interceptor == null) {
                throw new Error("Interceptor does not exisit: '" + interceptorName + "'.");
            }
            this._defaultExecutionStack.push(interceptor);
        }

        // Prepare per-entrypoint execution stack.
        this._perEntryPointExecutionStack = new Map<string, Interceptor[]>();
        this._perAppObjectContext.forEach(object => {
            if (object.def.value._type === 'EntryPoint') {
                let executionStack: Interceptor[] = this._defaultExecutionStack;
                let customStack = object.def.value.executionStack;
                
                // Entrypoint has specified executionStack.
                if (customStack != null) {
                    executionStack = [];
                    for (let interceptorName of <string[]>(customStack)) {
                        let interceptor = this.getInterceptor(interceptorName);
                        if (interceptor == null) {
                            throw new Error("Interceptor does not exist: '" + interceptorName + "'");
                        }
                        executionStack.push(interceptor);
                    }
                }
                this._perEntryPointExecutionStack.set(
                    object.def.name, 
                    executionStack);
            }
        });

        // Create default template.
        this._defaultRequestTemplate = new RequestTemplate(
            this.id,        // Use application id as fake template Uri.
            this,           // Application.
            undefined,      // No base template.
            {
                application: this.id,
                overrideTypes: [],
                overrideProviders: [],
                overrideObjects: []
            });

        // Create metrics.
        this._metrics = {};
        if (settings.metrics != null) {
            this._metrics = createMetricCollection(settings.metrics);
        }
    }

    /// <summary> Get application ID. </summary>
    /// <returns> Application ID. </returns>
    public get id(): string {
        return this._settings.id;
    }

    /// <summary> Get application description. </summary>
    /// <returns> Application description. </returns>
    public get description(): string {
        return this._settings.description;
    }

    /// <summary> Get Application settings. </summary>
    /// <returns> Application settings. </returns>
    public get settings(): ApplicationSettings {
        return this._settings;
    }

    /// <summary> Get application level object context. </summary>
    /// <returns> Application level object context. </returns>
    public get objectContext(): ScopedObjectContext {
        return this._perAppObjectContext;
    }

    /// <summary> Get default execution stack. </summary>
    /// <returns> Interceptor list configured as default stack. </returns>
    public get defaultExecutionStack(): Interceptor[] {
        return this._defaultExecutionStack;
    }

    /// <summary> Get default request template. </summary>
    /// <returns> Default request template which simply pass through all application-level context. </returns>
    public get defaultRequestTemplate(): RequestTemplate {
        return this._defaultRequestTemplate
    }

    /// <summary> Get execution stack for an entrypoint before any request override. </summary>
    /// <param name="entryPointName"> Entrypoint name. </param>
    /// <returns> Execution stack. </returns> 
    public getExecutionStack(entryPointName: string): Interceptor[] {
        if (this._perEntryPointExecutionStack.has(entryPointName)) {
            return this._perEntryPointExecutionStack.get(entryPointName);
        }
        return null;
    }
    /// <summary> Get metric collection of this application. </summary>
    /// <returns> Metric collection of current application. </summary>
    public get metrics(): MetricCollection {
        return this._metrics;
    }

    /// <summary> Create object from input. Throw exception if creation failed. </summary>
    /// <param name="input"> Any JS value </param>
    /// <returns> JS value created. </returns>
    public create(input: any): any {
        return this._perAppObjectContext.create(input);
    }

    /// <summary> Get the value of a named object. </summary>
    /// <param name='name'> Name of the object. Case sensitive. </param>
    /// <returns> Value of the named object or null if not found. </returns>
    public get(name: string): any {
        let namedObject = this.getNamedObject(name);
        if (namedObject != null) {
            return namedObject.value;
        }
        return null;
    }

    /// <summary> Get application level named object. </summary>
    /// <param name="name"> Name. Case-sensitive. </param>
    /// <returns> Named object if found. Otherwise undefined. </returns>    
    public getNamedObject(name: string): NamedObject {
        return this._perAppObjectContext.get(name);
    }

    /// <summary> Get entry point from current application. Throws exception if entry point is not found. </summary>
    /// <param name="entryPointName"> Entry point name, case sensitive. </param>
    /// <returns> Entrypoint (function) if found. Otherwise throws exception. </returns>
    public getEntryPoint(entryPointName: string): EntryPoint  {
        let object = this.getNamedObject(entryPointName);
        if (object != null && object.def.value._type != 'EntryPoint') {
            throw new Error("Object '" + entryPointName + "' is not of EntryPoint type. Encountered: '" + object.def.name + "'.");
        }
        return object != null? object.value : null;
    }

    /// <summary> Get interceptor by name. </summary>
    /// <param name="name"> Interceptor name. </param>
    /// <returns> Interceptor object if found, undefined otherwise. </returns>
    public getInterceptor(name: string): Interceptor {
        let object = this.getNamedObject(name);
        if (object != null && object.def.value._type !== 'Interceptor') {
            throw new Error("Object '" + name + "' is not of Interceptor type. Encountered: '" + object.def.name + "'.");
        }
        return object == null? null: object.value;
    }

    /// <summary> Get a function as a named object from current application. Throws exception if function is not found or not a function object. </summary>
    /// <param name="functionName"> Function name, case sensitive. </param>
    /// <returns> Function object if found. Otherwise throws exception. </returns>
    public getFunction(functionName: string): any {
        let object = this.getNamedObject(functionName);
        let fun = object == null ? null : object.value;
        if (fun != null && typeof fun !== 'function') {
            throw new Error("Object '" + functionName + "' is not a function.");
        }
        return fun;
    }
}


const SCHEMA_DIR: string = path.resolve(__dirname, '../schema');

/// <summary> Helper class to read ApplicationSettings from config. </summary>
export class ApplicationConfig {
    /// <summary> JSON schema used to validate config. </summary>
    private static readonly APP_CONFIG_SCHEMA: utils.JsonSchema 
        = new utils.JsonSchema(path.resolve(SCHEMA_DIR, "application-config.schema.json"));

    /// <summary> Create ApplicationSettings from a JS object that conform with schema.
    /// Throw exception if JS object doesn't match schema.
    /// Schema: "../schema/application-config.schema.json"
    /// </summary>
    /// <param name="parentSettings"> Host settings to inherit as default values. </param>
    /// <param name="jsValue"> a JS value to create ApplicationSettings object. </param>    
    /// <param name="basePath"> Base path used to resolve relative paths. </param>
    /// <returns> An ApplicationSettings object. </returns>
    public static fromConfigObject(
        hostSettings: Settings, 
        jsValue: any, 
        basePath: string): ApplicationSettings {

        utils.ensureSchema(jsValue, this.APP_CONFIG_SCHEMA);

        let appSettings: ApplicationSettings = {
            baseDir: basePath,
            id: jsValue.id,
            description: jsValue.description,
            allowPerRequestOverride: jsValue.allowPerRequestOverride,
            defaultExecutionStack: jsValue.defaultExecutionStack,
            objectContextDef: hostSettings.objectContextDef,
            metrics: []
        };

        // Optional: allowPerRequestOverride. 
        // Inherit host settings if it's not provided from application.
        if (appSettings.allowPerRequestOverride == null) {
            appSettings.allowPerRequestOverride = hostSettings.allowPerRequestOverride;
        }

        // Optional: defaultExecutionStack. 
        // Inherit host settings if it's not provided from application.
        if (appSettings.defaultExecutionStack == null) {
            appSettings.defaultExecutionStack = hostSettings.defaultExecutionStack;
        }

        // Required: 'objectTypes'
        let typeDefFiles: string[] = jsValue.objectTypes;
        let typeDefinitions: TypeDef[] = [];
        let typeToFileName: { [typeName: string]: string } = {};
        for (let typeDefFile of typeDefFiles) {
            let typeDefs = TypeConfig.fromConfig(path.resolve(basePath, typeDefFile));
            for (let typeDefinition of typeDefs) {
                if (typeToFileName.hasOwnProperty(typeDefinition.typeName)
                    && !typeDefinition.override) {
                    throw new Error("Object type '"
                        + typeDefinition.typeName
                        + "' already exists in file '"
                        + typeToFileName[typeDefinition.typeName]
                        + "'. Did you forget to set property 'override' to true? ");
                }
                typeDefinitions.push(typeDefinition);
                typeToFileName[typeDefinition.typeName] = typeDefFile;
            }
        }

        // Optional: 'objectProviders'
        let providerDefFiles: string[] = jsValue.objectProviders;
        let providerDefinitions: ProviderDef[] = [];
        let protocolToFileName: { [protocolName: string]: string } = {};
        if (providerDefFiles != null) {
            for (let providerDefFile of providerDefFiles) {
                let providerDefs = ProviderConfig.fromConfig(path.resolve(basePath, providerDefFile));
                for (let providerDef of providerDefs) {
                    if (protocolToFileName.hasOwnProperty(providerDef.protocol)
                        && !providerDef.override) {
                        throw new Error("Object provider with protocol '"
                            + providerDef.protocol
                            + "' already exists in file '"
                            + protocolToFileName[providerDef.protocol]
                            + "' .Did you forget to set property 'override' to true? ");
                    }
                    providerDefinitions.push(providerDef);
                    protocolToFileName[providerDef.protocol] = providerDefFile;
                }
            }
        }

        // Required: 'namedObjects'
        let namedObjectDefFiles: string[] = jsValue.namedObjects;
        let namedObjectDefinitions: NamedObjectDef[] = [];
        let nameToFileName: {[objectName: string]: string} = {};

        for (let namedObjectDefFile of namedObjectDefFiles) {
            let objectDefs = NamedObjectConfig.fromConfig(path.resolve(basePath, namedObjectDefFile));
            for (let objectDef of objectDefs) {
                if (nameToFileName.hasOwnProperty(objectDef.name)
                    && !objectDef.override) {
                    throw new Error("Named object'"
                        + objectDef.name
                        + "' already exists in file '"
                        + nameToFileName[objectDef.name]
                        + "'. Did you forget to set property 'override' to true? ");
                }
                namedObjectDefinitions.push(objectDef);
                nameToFileName[objectDef.name] = namedObjectDefFile;
            }
        }

        appSettings.objectContextDef = new ScopedObjectContextDef(
            hostSettings.objectContextDef,
            typeDefinitions,
            providerDefinitions,
            namedObjectDefinitions,
            true                        // Enable depenency check.
            );      

        // Optional: 'metrics'
        let metricDefObject: any = jsValue.metrics;
        if (metricDefObject != null) {
            let sectionName = metricDefObject.sectionName;                    
            let metricDefFiles: string[] = metricDefObject.definition;
            let metricToFilename: { [metricName: string]: string } = {}
            
            metricDefFiles.forEach(metricDefFile => {
                let metricDefs = MetricConfig.fromConfig(
                    sectionName,
                    path.resolve(basePath, metricDefFile));

                metricDefs.forEach(metricDef => {
                    if (metricToFilename.hasOwnProperty(metricDef.name)) {
                        throw new Error("Metric '"
                            + metricDef.name
                            + "' already defined in file '"
                            + metricToFilename[metricDef.name]
                            + "'.");
                    }
                    appSettings.metrics.push(metricDef);
                    metricToFilename[metricDef.name] = metricDefFile;
                });
            });
        }
        return appSettings;
    }

    /// <summary> Create ApplicationSettings object from application config file (.config or .json)
    /// Throws exception if configuration file parse failed or doesn't match the schema.
    /// Schema: '../schema/application-config.schema.json'
    /// </summary>
    /// <param name="parentSettings"> Parent settings to inherit. </param>
    /// <param name="appConfigFile"> a JSON file in application config schema. </param>
    public static fromConfig(
        parentSettings: Settings, 
        appConfigFile: string): ApplicationSettings {

        return utils.appendMessageOnException(
            "Error found in application definition file '" + appConfigFile + "'.",
            () => { 
                return this.fromConfigObject(
                    parentSettings,
                    utils.readConfig(appConfigFile), path.dirname(appConfigFile)); 
            });
    }
}
