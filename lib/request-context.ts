// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

/////////////////////////////////////////////////////////////////////
/// Interfaces and classes for context object of a Winery.js request

import * as assert from 'assert';
import * as os from 'os';
import { log } from 'napajs';

import { Application, EntryPoint, Interceptor } from './application';

import { ControlFlags, Request, RequestHelper } from './request';
import { ResponseCode, Response, ResponseHelper, DebugInfo, DebugEvent } from './response';
import { RequestTemplate } from './request-template';

import { NamedObject} from './named-object'
import { ScopedObjectContext, ScopedObjectContextDef} from './object-context'

import { MetricCollection } from './metric';

/// <summary> Class for request context.
/// Request context is the access point for all winery capabilities during serving a request.
/// </summary>
export class RequestContext {
    /// <summary> Application</summary>
    private _application: Application = null;

    /// <summary> Request</summary>
    private _request: Request = null;

    /// <summary> Entry point  </summary>
    private _entryPoint: EntryPoint = null;

    /// <summary> Request level object context. </summary>
    private _perRequestObjectContext: ScopedObjectContext = null;

    /// <summary> Per request logger. </summary>
    private _logger: RequestLogger = null;

    /// <summary> Debugger. </summary>
    private _debugger: RequestDebugger = null; 

    /// <summary> Execution state: current depth in execution stack. </summary>
    private _executionDepth: number = 0;

    /// <summary> Execution stack.
    private _executionStack: Interceptor[];
    
    /// <summary> Constructor </summary>
    public constructor(base: RequestTemplate, request: Request) {
        assert(base != null);
        assert(request != null);

        // Fill default values and do schema validation.
        request = RequestHelper.fromJsValue(request);
        
        this._application = base.application;
        this._request = request;

        //let parentContext: ScopedObjectContext = base != null ? base.objectContext : app.objectContext;
        let parentContext = base.objectContext;

        // We only pass overriden stuff when per-request override is allowed.
        let perRequestObjectContextDef: ScopedObjectContextDef = 
            base.application.settings.allowPerRequestOverride ?
                new ScopedObjectContextDef(
                    parentContext.def,
                    request.overrideTypes,
                    request.overrideProviders,
                    request.overrideObjects,
                    false                           // Don't do dependency analysis at request level.
                )
                :
                new ScopedObjectContextDef(
                    parentContext.def,
                    [],
                    [], 
                    [], 
                    false);

        this._perRequestObjectContext = new ScopedObjectContext(
            "request",
            parentContext.baseDir,      // We always use application directory as base dir for resolving paths in request.
            parentContext,
            perRequestObjectContextDef);

        // Prepare execution stack and entry point.
        this._entryPoint = this.getEntryPoint(request.entryPoint);
        if (this._entryPoint == null) {
            throw new Error("Entrypoint does not exist: '" + request.entryPoint + "'");
        }

        this._executionStack = this.prepareExecutionStack(request.entryPoint);

        // Prepare logger and debuger.
        this._logger = new RequestLogger(
            request.application + "." + request.entryPoint,
            request.traceId);

        this._debugger = new RequestDebugger();

        // Set execution depth to 0 to be at top of execution stack.
        this._executionDepth = 0;
    }

    /// <summary> prepare execution stack for an entrypoint name, assuming per-request object context is setup. </summary>
    private prepareExecutionStack(entryPointName: string): Interceptor[] {
        // If nothing has been overrided, use cached execution stack directly. 
        if (this._perRequestObjectContext.def.namedObjectDefs.length == 0) {
            if (this._entryPoint == null) {
                throw new Error("Entrypoint '" + entryPointName + "' does not exist.");
            }
            return this._application.getExecutionStack(entryPointName);
        } 

        // Per-request override happens, it could be entrypoint override or interceptor override.
        let entryPointObject = this.getNamedObject(entryPointName);
        let interceptorNames: string[] = entryPointObject.def.value.executionStack;
        if (interceptorNames == null) {
            interceptorNames = this.application.settings.defaultExecutionStack;
        }

        // When entrypoint is not overriden, check if interceptor definition has be overriden.
        if (entryPointObject.scope !== 'request') {
            let oldStack = this.application.getExecutionStack(entryPointName);
            let newStack: Interceptor[] = [];
        
            // Definition and pre-cached execution stack should align.
            assert(oldStack.length == interceptorNames.length);

            for (let i = 0; i < oldStack.length; ++i) {
                let interceptorName = interceptorNames[i];
                let interceptorObject = this.getNamedObject(interceptorName);
                if (interceptorObject == null) {
                    throw("Interceptor '" + interceptorName + "' does not exist.");
                }
                
                if (interceptorObject.scope !== 'request') {
                    newStack.push(oldStack[i]);
                }
                else {
                    // Interceptor is overriden from request. Look up new.
                    if (interceptorObject.value == null
                        || interceptorObject.def.value._type !== 'Interceptor') {
                        throw new Error("Bad override on interceptor '" 
                            + interceptorName 
                            + "', should be of Interceptor type and not null. ")
                    }
                    newStack.push(interceptorObject.value);
                }
            }
            return newStack;
        }

        // Per-request override happens on current entry point.
        let newStack: Interceptor[] = [];
        for (let interceptorName of interceptorNames) {
            let interceptor = this.getInterceptor(interceptorName);
            if (interceptor == null) {
                throw new Error("Interceptor '" + interceptorName + "' is not a valid interceptor.");
            }
            newStack.push(interceptor);
        }
        return newStack;
    }

    ///////////////////////////////////////////////////////////////////
    /// Operational interfaces

    /// <summary> Execute current request with a promise of response. </summary>
    public async execute(): Promise<Response> {
        return this.continueExecution();
    }

    /// <summary> Continue execution from current interceptor. </summary>
    public async continueExecution(): Promise<Response> {
        if (this._executionDepth < this._executionStack.length) {
            return this._executionStack[this._executionDepth++](this);
        }
        return Promise.resolve({ responseCode: ResponseCode.Success });
    }

    ///////////////////////////////////////////////////////////////////
    /// Informational interfaces

    /// <summary> Get application of current request. </summary>
    public get application(): Application {
        return this._application;
    }

    /// <summary> Get the request used to create this context. </summary>
    public get request(): Request {
        return this._request;
    }

    /// <summary> Entrypoint </summary>
    public get entryPoint(): EntryPoint {
        return this._entryPoint;
    }

    /// <summary> Get entry point name. </summary>
    public get entryPointName(): string {
        return this._request.entryPoint;
    }

    /// <summary> Get trace ID of current request. </summary>
    public get traceId(): string {
        return this._request.traceId;
    }

    /// <summary> Get control flags. </summary>
    public get controlFlags(): ControlFlags {
        return this._request.controlFlags;
    }

    /// <summary> getter for metric collection. </summary>
    public get metric(): MetricCollection {
        return this._application.metrics;
    }

    /// <summary> Get input for entry point. </summary>
    public get input(): any {
        return this._request.input;
    }

    /// <summary> Get per request logger. </summary>
    public get logger(): RequestLogger {
        return this._logger;
    }

    /// <summary> Get debug info writter. </summary>
    public get debugger(): RequestDebugger {
        return this._debugger;
    }

    ///////////////////////////////////////////////////////////////
    /// Behavioral interfaces
    
    /// <summary> Create object from input. </summary>
    /// <param name='input'> Input for creating object with type or URI </param>
    /// <returns> Created object. </returns>
    public create(input: any): any {
        return this._perRequestObjectContext.create(input);
    }

    /// <summary> Get the value of a named object. </summary>
    /// <param name='name'> Name of the object. Case sensitive. </param>
    /// <returns> Value of the named object or null if not found. </returns>
    public get(name: string): any {
        let namedObject = this.getNamedObject(name);
        if (namedObject != null) {
            return namedObject.value;
        }
        return undefined;
    }

    /// <summary> Get named object from input. </summary>
    /// <param name='name'> Name of the object. Case sensitive. </param>
    /// <returns> Named object or null if not found. </returns>
    public getNamedObject(name: string): NamedObject {
        return this._perRequestObjectContext.get(name);
    }

    /// <summary> Helper method to get entry point from application of request context. Throws exception if entry point is not found. </summary>
    /// <param name="entryPointName"> Entry point name, case sensitive. </param>
    /// <returns> Entrypoint (function) if found. Otherwise throws exception. </returns>
    public getEntryPoint(entryPointName: string): EntryPoint  {
        let object = this.getNamedObject(entryPointName);
        if (object != null && object.def.value._type != 'EntryPoint') {
            throw new Error("Object '" + entryPointName + "' is not of EntryPoint type.");
        }
        return object != null? object.value : null;
    }

    /// <summary> Get interceptor by name. </summary>
    /// <param name="name"> Interceptor name. </param>
    /// <returns> Interceptor object if found, undefined otherwise. </returns>
    public getInterceptor(name: string): Interceptor {
        let object = this.getNamedObject(name);
        if (object != null && object.def.name !== 'Interceptor') {
            throw new Error("Object '" + name + "' is not of Interceptor type.");
        }
        return object == null? null: object.value;
    }

    /// <summary> Helper method to get function from application of request context. Throws exception if function is not found or not a function object. </summary>
    /// <param name="functionName"> Function name, case sensitive. </param>
    /// <returns> Function object or null. If object associated with functionName is not a function, exception will be thrown. </returns>
    public getFunction(functionName: string): any {
        let func = this.get(functionName);
        if (func != null && typeof func !== 'function') {
            throw new Error("Object '" + functionName + "' is not a function.");
        }
        return func;
    }
}

/// <summary> Class for request debugger, which writes debugInfo in response. </summary>
export class RequestDebugger {
    /// <summary> Set last error that will be output in debug info. </summary>
    public setLastError(lastError: Error) {
        this._lastError = lastError;
    }

    /// <summary> Output an object with a key in debugInfo/details. </summary>
    public detail(key: string, value: any): void {
        this._details[key] = value;
    }

    /// <summary> Add a debug event with a log level and message. </summary>
    public event(logLevel: string, message: string): void {
        this._events.push({
            eventTime: new Date(),
            logLevel: logLevel,
            message: message
        });
    }

    /// <summary> Finalize debug info writer and return a debug info. </summary>
    public getOutput(): DebugInfo {
        return  {
            exception: {
                message: this._lastError.message,
                stack: this._lastError.stack,
            },
            details: this._details,
            events: this._events,
            machineName: os.hostname(),
        };
    }

    private _lastError: Error = null;
    private _details: {[key: string]: any} = {};
    private _events: DebugEvent[] = [];
}

/// <summary> Request logger that encapsulate section name and trace ID. </summary>
export class RequestLogger {
    public constructor(sectionName: string, traceId: string) {
        this._sectionName = sectionName;
        this._traceId = traceId;
    }

    /// <summary> Log message with Debug level. </summary>
    public debug(message: string) {
        log.debug(this._sectionName, this._traceId, message);
    }

    /// <summary> Log message with Info level. </summary>
    public info(message: string) {
        log.info(this._sectionName, this._traceId, message);
    }

    /// <summary> Log message with Warn level. </summary>
    public warn(message: string) {
        log.warn(this._sectionName, this._traceId, message);
    }

    /// <summary> Log message with Error level. </summary>
    public err(message: string) {
        log.err(this._sectionName, this._traceId, message);
    }

    private _traceId: string;
    private _sectionName: string;
}