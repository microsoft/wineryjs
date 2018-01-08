// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

/////////////////////////////////////////////////////////////////////
/// Interface and classes for Winery.js response object

import * as utils from './utils';
import * as path from 'path';

/// <summary> Response code </summary>
export enum ResponseCode {
    // Success.
    Success = 0,

    // Internal error.
    InternalError = 1,

    // Server side timeout.
    ProcessTimeout = 2,

    // Throttled due to policy.
    Throttled = 3,

    // Error caused by bad input.
    InputError = 4
}

/// <summary> Exception information in response. </summary>
export type ExceptionInfo = {
    stack: string;
    message: string;
    fileName?: string;
    lineNumber?: number;
    columnNumber?: number;
}

/// <summary> Debug event in DebugInfo. </summary>
export type DebugEvent = {
    eventTime: Date;
    logLevel: string;
    message: string;
}

/// <summary> Debug information when debug flag is on. </summary>
export type DebugInfo = {
    exception: ExceptionInfo;
    events: DebugEvent[];
    details: { [key: string]: any };
    machineName: string;
}

/// <summary> Write performance numbers when perf flag is on. </summary>
export type PerfInfo = { [perfKey: string]: number };

/// <summary> Interface for response </summary>
export interface Response {
    /// <summary> Response code </summary>
    responseCode: ResponseCode;

    /// <summary> Error message if response code is not Success. </summary>
    errorMessage?: string;

    /// <summary> Output from entrypoint. </summary>
    output?: any;

    /// <summary> Debug information. </summary>
    debugInfo?: DebugInfo;

    /// <summary> Performance numbers. </summary>
    perfInfo?: PerfInfo;
}

/// <summary> Response helper. </summary>
export class ResponseHelper {
    /// <summary> JSON schema for response. </summary>
    private static readonly RESPONSE_SCHEMA: utils.JsonSchema = new utils.JsonSchema(
        path.resolve(path.resolve(__dirname, '../schema'), "response.schema.json"));

    /// <summary> Parse a JSON string that conform with response schema. </summary>
    public static parse(jsonString: string): Response {
        let response = utils.parseJsonString(jsonString, this.RESPONSE_SCHEMA);
        return <Response>(response);
    }

    /// <summary> Validate a JS value against response schema. </summary>
    public static validate(jsValue: any): boolean {
        return this.RESPONSE_SCHEMA.validate(jsValue);
    }
}