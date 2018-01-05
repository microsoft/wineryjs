// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as path from 'path';
import * as utils from './utils';

import { TypeDef, ProviderDef, NamedObjectDef }from './object-model';

/// <summary> Interface for control flags. </summary>
export type ControlFlags = {
    /// <summary> Enable debugging or not. Set to false by default. </summary>
    debug?: boolean;

    /// <summary> Return performance numbers or not. Set to false by default. </summary>
    perf?: boolean;
}

/// <summary> Interface for winery request. </summary>
export interface Request {
    /// <summary> Registered application instance name. Required unless "base" is present. </summary>
    application?: string;

    /// <summary> Uri for request template to apply. Optional. </summary>
    base?: string

    /// <summary> Entry point name </summary>
    entryPoint: string;

    /// <summary> Trace ID </summary>
    traceId?: string;

    /// <summary> User input as the 1st argument passing to entry point function </summary>
    input?: any;

    /// <summary> Control flags </summary>
    controlFlags?: ControlFlags;

    /// <summary> Overridden types </summary>
    overrideTypes?: TypeDef[];

    /// <summary> Overridden named objects </summary>
    overrideObjects?: NamedObjectDef[];

    /// <summary> Overridden providers </summary>
    overrideProviders?: ProviderDef[];
}

/// <summary> Request helper. </summary>
export class RequestHelper {
    /// <summary> JSON schema for resquest. </summary>
    private static readonly REQUEST_SCHEMA: utils.JsonSchema = new utils.JsonSchema(
        path.resolve(path.resolve(__dirname, '../schema'), "request.schema.json"));

    /// <summary> Set default values transform. </summary>
    private static _transform = new utils.SetDefaultValue({
        traceId: "Unknown",
        overrideObjects: [],
        overrideProviders: [],
        overrideTypes: [],
        controlFlags: {
                debug: false,
                perf: false
            }
    });

    /// <summary> Tell if a jsValue is a valid request at run time. </summary>
    public static validate(jsValue: any): boolean {
        return this.REQUEST_SCHEMA.validate(jsValue);
    }

    /// <summary> Create request from a JS value that conform with request schema. </summary>
    public static fromJsValue(jsValue: any): Request {
        if (!this.validate(jsValue))
            throw new Error(`Request doesn't match request schema: ${JSON.stringify(this.REQUEST_SCHEMA.getErrors())}`);
        
        let request = <Request>(jsValue);
        this._transform.apply(request);
        // TODO: @dapeng, make SetDefaultValue recursive.
        if (request.controlFlags.debug == null) {
            request.controlFlags.debug = false;
        }

        if (request.controlFlags.perf == null) {
            request.controlFlags.perf = false;
        }

        return request;
    }
}