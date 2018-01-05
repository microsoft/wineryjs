// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

//////////////////////////////////////////////////////////////////
// Utility classes and methods used internally in Winery.js

import fs = require('fs');
import path = require('path');

// TODO: replace bundle with node module dependencies once 'url' and 'events' are introduced in Napa.JS.
var Ajv = require('./ajv-bundle');

/// <summary> Class that wraps JSON schema validation. </summary>
export class JsonSchema {
    private _fileName: string;

    private _validator: any;

    /// <summary> Static AJV engine to create pre-compiled validator </summary>
    /// This path is to be compatible with V8 isolates/
    private static _ajv = Ajv();

    /// <summary> Validate a JS value against current schema. </summary>
    /// <param name="jsValue"> a JS value </param>
    /// <returns> True if validation succeeded, otherwise false. </returns>
    public validate(jsValue: any): boolean {
        return this._validator(jsValue);
    }

    /// <summary> Get schema file name. </summary>
    /// <returns> Schema file name. </returns>
    public getFileName(): string {
        return this._fileName;
    }

    /// <summary> Get errors from previous validation. </summary>
    /// <returns> Errors from previous validation. </returns>
    public getErrors(): string {
        return this._validator.errors;
    }

    /// <summary> Constructor </summary>
    /// <param name="fileName"> JSON schema file name.</param>
    public constructor(fileName: string) {
        this._fileName = fileName;
        var schemaObject = parseJsonFile(fileName);
        /// This path is to be compatible with V8 isolates/
        this._validator = JsonSchema._ajv.compile(schemaObject);
    }
}

/// <summary> Ensure a JS value match a JSON schema. Throws exception if it doesn't match. </summary>
/// <param name="jsValue"> Any JS value type. </param>
/// <param name="jsonSchema"> JSON schema object. </param>
export function ensureSchema(jsValue: any, jsonSchema: JsonSchema): void {
    if (!jsonSchema.validate(jsValue)) {
        throw new Error(
            "Object '"
            // + JSON.stringify(jsValue)
            + "' doesn't match schema '"
            + jsonSchema.getFileName() + "':"
            + JSON.stringify(jsonSchema.getErrors()));
    }
}

/// <summary> Parse JSON string into JS value. Validate with json schema if present. </summary>
/// <param name="jsonString"> JSON string. </param>
/// <param name="jsonSchema"> JSON schema object. Optional </param>
/// <param name="allowComments"> Whether allow comments in JSON. 
/// REMARKS: PLEASE NOT TO ENABLE THIS DURING QUERY PROCESSING, WHICH IS REALLY SLOW < /param>
/// <returns> JS value. Throws exception if parse failed or schema validation failed. </returns>
export function parseJsonString(jsonString: string,
    jsonSchema: JsonSchema = undefined,
    allowComments: boolean = false): any {

    /// This path is to be compatible with V8 isolates/
    if (allowComments) {
        var stripJsonComments = require('strip-json-comments');
        jsonString = stripJsonComments(jsonString);
    }

    try {
        var jsValue = JSON.parse(jsonString);
    }
    catch (error) {
        throw new Error("Failed to parse JSON ':" + error.toString());
    }

    if (jsonSchema != null) {
        ensureSchema(jsValue, jsonSchema);
    }
    return jsValue;
}

/// <summary> Parse JSON file. 
/// Throw exception if parse failed or JSON schema validation failed.
/// </summary>
/// <param name="jsonFile"> JSON file to parse. </param>
/// <param name="jsonSchema"> JSON schema object. </param>
/// <param name="allowComments"> Whether allow comments in JSON. </param>
/// <returns> JS value parsed from JSON file. </returns>
export function parseJsonFile(jsonFile: string,
    jsonSchema: JsonSchema = undefined,
    allowComments: boolean = false): any {
    return appendMessageOnException(
        ".Error file name: '" + jsonFile + "'.",
        () => { return parseJsonString(readJsonString(jsonFile), jsonSchema, allowComments); });
}

/// <summary> Read JSON string from file. </summary>
export function readJsonString(jsonFile: string): string {
    return fs.readFileSync(jsonFile, 'utf8').replace(/^\uFEFF/, '');
}

/// <summary> Read JS value from a config file with extension '.json'.
/// This method was introduced to make Winery code transparent to the format of configuration file in future.
/// </summary>
/// <param name='filePath'> File path with ".json" extension </param>
/// <returns> JS values if parsed successfully. Throw exception if failed. </returns>
export function readConfig(filePath: string, jsonSchema?: JsonSchema): any {
    if (path.extname(filePath).toLowerCase() != '.json') {
        throw new Error("readConfig only support '.json' as extension. filePath='"
            + filePath + "'.");
    }
    // We allow comments in JSON configuration files.
    return parseJsonFile(filePath, jsonSchema, true);
}

/// <summary> Interface for JS value transformation. </summary>
export interface Transform {
    apply(jsValue: any): any;
};

export class ChainableTransform implements Transform {
    protected _next: ChainableTransform = null;
    public add(next: ChainableTransform): ChainableTransform { 
        var node: ChainableTransform = this;
        while (node._next != null) {
            node = node._next;
        }
        node._next = next;
        return this;
    }

    public apply(jsValue: any): any {
        var transformedValue = this.transform (jsValue);
        if (this._next != null) {
            return this._next.apply(transformedValue);
        }
        return transformedValue;
    }

    protected transform(jsValue: any): any {
        throw new Error("Not implemented");
    }
};

/// <summary> Rename properties of a JS object </summary>
export class RenameProperties extends ChainableTransform {
    private _nameMap: { [oldName: string]: string };

    /// <summary> Constructor </summary>
    /// <param name="nameMap"> Old name to new name mapping. </param>
    public constructor(nameMap: { [oldName: string]: string }) {
        super();
        this._nameMap = nameMap;
    }

    /// <summary> Do transformation by rename properties. </summary>
    /// <param name="jsObject"> container JS object to rename properties. </param>
    public transform(jsObject: {[propertyName:string]: any}): any {
        var oldNames: string[] = Object.keys(this._nameMap);
        oldNames.forEach(oldName => {
            jsObject[this._nameMap[oldName]] = jsObject[oldName];
            delete jsObject[oldName];
        });
        return jsObject;
    }
} 

/// <summary> Set default value for properties that are undefined or null </summary>
export class SetDefaultValue extends ChainableTransform {
    private _defaultValueMap: { [propertyName: string]: any };

    /// <summary> Constructor </summary>
    /// <param name="nameMap"> Property name to default value map. </param>
    public constructor(defaultValueMap: { [propertyName: string]: any }) {
        super();
        this._defaultValueMap = defaultValueMap;
    }

    /// <summary> Do transformation by set default values for fields that does't appear in object. </summary>
    /// <param name="jsObject"> JS object </param>
    public transform(jsObject: {[propertyName:string]: any}): any {
        var propertyNames: string[] = Object.keys(this._defaultValueMap);
        propertyNames.forEach(propertyName => {
            if (!jsObject.hasOwnProperty(propertyName)) {
                jsObject[propertyName] = this._defaultValueMap[propertyName];
            }
        });
        return jsObject;
    }
}

/// <summary> Interface for value transform function </summary>
export interface ValueTransform {
    (input: any): any
}

/// <summary> Value transfor of a JS value to another </summary>
export class TransformPropertyValues extends ChainableTransform {
    private _propertyNameToTransformMap: { [propertyName: string]: ValueTransform };

    /// <summary> Constructor </summary>
    /// <param name="nameMap"> Property name to value transform function. </param>
    public constructor(propertyNameToTransformMap: { [propertyName: string]: ValueTransform }) {
        super();
        this._propertyNameToTransformMap = propertyNameToTransformMap;
    }

    /// <summary> Do transformation by transforming values on properties. </summary>
    /// <param name="jsObject"> container JS object. </param>
    public transform(jsObject: { [propertyName: string]: any }): any {
        var oldNames: string[] = Object.keys(this._propertyNameToTransformMap);
        oldNames.forEach((propertyName: string) => {
            jsObject[propertyName] = this._propertyNameToTransformMap[propertyName](jsObject[propertyName]);
        });
        return jsObject;
    }
} 

/// <summary> An operation on a singular node that produce a output 
/// A singular node is a JS node which is a object like { } or an 1-element array. [{ //...}]
/// </summary>
interface SingularNodeOperation {
    (node: any): any;
}

/// <summary> Result from a singular node operation. </summary>
/// operationPerformed indicates if a target is a singular node or not.
/// result is the returned value from the operation. 
class SingularNodeOperationResult {
    public constructor(public operationPerformed: boolean, public result?: any) {
    }
}

/// <summary> Include file name in exception when thrown.
export function appendMessageOnException(message: string, fun: Function) : any {
    try {
        return fun();
    }
    catch (error) {
        error.message += message;
        throw error;
    }
}

/// <summary> Make a return value as a resolved Promise or return if it is already a Promise. </summary>
export function makePromiseIfNotAlready(returnValue: any): Promise<any> {
    if (returnValue != null 
        && typeof returnValue === 'object'
        && typeof returnValue['then'] === 'function') {
        return returnValue;
    }
    return Promise.resolve(returnValue);
}

/// <summary> Load a function object given a name from a module. </summary>
export function loadFunction(moduleName: string, functionName: string) {
    let module = require(moduleName);
    if (module == null) {
        throw new Error("Cannot load module '" + moduleName + "'.");
    }
    
    let func = module;
    for (let token of functionName.split(".")) {
        if (token.length == 0) {
            continue;
        }
        func = func[token];
        if (func == null) {
            throw new Error("Cannot load function '" 
                + functionName 
                + "' in module '" 
                + moduleName 
                + "'. Symbol '"
                + token
                + "' doesn't exist.");
        }
    }
    return func;
}