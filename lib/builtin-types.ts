// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { EntryPoint, Interceptor } from './application';
import { ObjectContext } from './object-context';
import { RequestContext } from './request-context';
import { Request } from './request';
import { Response } from './response';

import * as utils from './utils';
import * as path from 'path';

////////////////////////////////////////////////////////////////////////
/// JSON definition for built-in object types.

/// <summary> Definition for function object. </summary>
export interface FunctionDefinition {
    // <summary> For referencing existing function. </summary>
    moduleName?: string,
    functionName?: string,

    /// <summary> for inline function. </summary>
    function?: string;
}

/// <summary> Entrypoint definition. </summary>
export interface EntryPointDefinition extends FunctionDefinition {
    /// <summary> _type === 'EntryPoint' </summary>
    _type: "EntryPoint",

    /// <summary> Optional. Description of entrypoint. </summary>
    description?: string,

    /// <summary> Optional. Custom execution stack of interceptor names. </summary>
    executionStack?: string[],

    /// <summary> Optional. Display rank. </summary>
    displayRank?: number,

    /// <summary> Optional. Example requests. This is for human consumption. </summary>.
    exampleRequests?: Request[],

    /// <summary> Optional. Example responses. </summary>
    exampleResponses?: Response[]
};

/// <summary> Interceptor definition. </summary>
export interface InterceptorDefinition extends FunctionDefinition {
    /// <summary> _type === 'Interceptor' </summary>
    _type: "Interceptor",

    /// <summary> Optional. Description of interceptor </summary>
    description?: string,
};

////////////////////////////////////////////////////////////////////////////////
/// Object constructors for built-in objects.

/// <summary> Constructor for Function. </summary>
export function createFunction(
    definition: FunctionDefinition, 
    context: ObjectContext): Function {

    if (definition.function != null) {
        // Dynamicly created function.
        // TODO: do security check. 
        return eval('(' + definition.function + ')');
    }

    if (definition.moduleName != null && definition.functionName != null) {
        // create function from module and function name.
        let moduleName = definition.moduleName;
        if (moduleName.startsWith('.')) {
            moduleName = path.resolve(context.baseDir, moduleName);
        }
        return utils.appendMessageOnException("Unable to create function '" 
                + definition.function 
                + "' in module '" 
                + definition.moduleName 
                + "'.", 
                () => {
                    return utils.loadFunction(moduleName, definition.functionName);
                });
    }
    throw new Error("Either property group 'moduleName' and 'functionName' or property 'function' should be present for Function object.");
}

/// <summary> Constructor for EntryPoint. </summary>
export function createEntryPoint(
    definition: EntryPointDefinition,
    context: ObjectContext): EntryPoint {
    // TODO: any check?
    return <EntryPoint>createFunction(definition, context);
}

/// <summary> Constructor for Interceptor. </summary>
export function createInterceptor(
    definition: InterceptorDefinition,
    context: ObjectContext): Interceptor {
    // TODO: any check?
    return <Interceptor>createFunction(definition, context);
}

