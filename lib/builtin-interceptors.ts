// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { log } from 'napajs';

import * as app from './application';
import * as utils from './utils';

import {ResponseCode, Response} from './response'

/////////////////////////////////////////////////////////////////
/// Built-in interceptors.

/// <summary> Interceptor: pass through.
/// This interceptor is used for debug purpose when doing per-request override
/// <summary> 
export async function passThrough(
    context: app.RequestContext): Promise<Response> {
    return await context.continueExecution();
}

/// <summary> Interceptor: short circuit. 
/// This interceptor is used for debug purpose when doing per-request override
/// <summary> 
export async function shortCircuit(
    context: app.RequestContext): Promise<Response> {
    return Promise.resolve({
        responseCode: ResponseCode.Success
    });
}

/// <summary> Interceptor: execute entryPoint </summary>
export async function executeEntryPoint(
    context: app.RequestContext): Promise<Response> {

    let response = await context.continueExecution();
    response.output = await utils.makePromiseIfNotAlready(
            context.entryPoint(context, context.input));

    return response;
}

/// <summary> Interceptor: log request only. </summary>
export async function logRequest(
    context: app.RequestContext): Promise<Response> {

    log.debug(JSON.stringify(context.request));
    return await context.continueExecution();
}

/// <summary> Interceptor: log response only. </summary>
export async function logResponse(
    context: app.RequestContext): Promise<Response> {
    
    let response = await context.continueExecution();
    log.debug(JSON.stringify(response));
    return response;
}

/// <summary> Interceptor: log request and response. </summary>
export async function logRequestResponse(
    context: app.RequestContext): Promise<Response> {

    log.debug(JSON.stringify(context.request));
    let response = await context.continueExecution();
    log.debug(JSON.stringify(response));
    return response;
}

/// <summary> Interceptor: finalize response </summary>
export async function finalizeResponse(
    context: app.RequestContext): Promise<Response> {

    let startTime = process.hrtime(); 
    let response = await context.continueExecution();

    // Attach debug info if needed.
    if (context.controlFlags.debug) {
        response.debugInfo = context.debugger.getOutput();
    }

    // Attach perf info if needed.
    if (context.controlFlags.perf) {
        let duration = process.hrtime(startTime);
        response.perfInfo = {
            processingLatencyInMS : (duration[0] * 1e3 + duration[1] / 1e6)
        };
    }
    return response;
}
