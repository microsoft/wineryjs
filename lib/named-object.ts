// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as path from 'path';
import * as utils from './utils';

import { ObjectContext } from './object-context';

///////////////////////////////////////////////////////////////////////////////
// Interfaces for Named Objects.
// Named Objects are application-level objects with a well-known name, so user can retrive the object via app.getObject('<name>');
//
// There are two types of named objects.
// 1) Named objects provided from JSON file per application, whose lifecycle is process- level.
// 2) Named objects provided from a single Winery request, whose lifecycle is during the request.

/// <summary> Class for named object that holds a definition and value.
/// Definition is needed to construct this named object under a different ObjectContext, e.g, from request.
/// </summary>

/// <summary> Interface for Named object definition. </summary>
export interface NamedObjectDef {
    /// <summary> Name or key to retrieve this object. </summary>
    name: string;

    /// <summary> Description for this object. </summary>
    description?: string;

    /// <summary> If this object is private, means that cannot be listed by entry points `listNamedObjects`. </summary>
    private?: boolean;

    /// <summary> If this object overrides a previous object definition with the same name. 
    /// This may be useful if you borrow definition file from other apps and want to override individual ones.
    /// </summary>
    override?: boolean;

    /// <summary> Value of the input to create this named object, which is described by plain JavaScript object or URI.
    /// The plain JavaScript object / URI can be constructed by registered ObjectFactory and ObjectProvider.
    /// </summary>
    value: any;

    /// <summary> Dependency from current definition to object context. This is calculated automatically.</summary>
    dependencies?: ObjectContextDependency;
}

export interface NamedObject {
    /// <summary> Definition of current named object. </summary>
    def: NamedObjectDef;

    /// <summary> Value of current named object </summary>
    value: any;
    
    /// <summary> Scope of where this named object is provided. </summary>
    readonly scope: string;
}

/// <summary> Interface for Named Object collection. </summary>
export interface NamedObjectCollection {
    /// <summary> Get named object by name. </summary>
    /// <param name="name"> Name. Case-sensitive. </summary>
    /// <returns> Named object if found. Otherwise undefined. </returns>
    get(name: string): NamedObject;

    /// <summary> Iterator each object in this collection. </summary>
    forEach(callback: (object: NamedObject) => void): void;
} 


/// <summary> An implementation of NamedObjectCollection based on name to object registry. </summary>
export class NamedObjectRegistry implements NamedObjectCollection {
    /// <summary> Name to object map. Case sensitive. </summary>
    private _nameToObjectMap: Map<string, NamedObject> = new Map<string, NamedObject>();

    /// <summary> Get object by name. </summary>
    /// <param name="name"> Case sensitive name. </param>
    /// <returns> undefined if not present, otherwise an instance of NamedObject. </returns>
    public get(name: string): NamedObject {
        return this._nameToObjectMap.get(name);
    }

    /// <summary> Tell if a name exists in this registry. </summary>
    /// <returns> True if exists, otherwise false. </returns>
    public has(name: string): boolean {
        return this._nameToObjectMap.has(name);
    }

    /// <summary> Iterate each object in this registry. </summary>
    public forEach(callback: (object: NamedObject) => void): void {
        this._nameToObjectMap.forEach(object => {
            callback(object);
        });
    }

    /// <summary> Insert a named object. </summary>
    /// <param name="object"> an Named object instance. </param>
    public insert(object: NamedObject): void {
        this._nameToObjectMap.set(object.def.name, object);
    }

    /// <summary> Create NamedObjectRegistry from a collection of NamedObjectDefinition objects. </summary>
    /// <param name="scope"> Scope that current object definition apply to. Can be 'global', 'application', 'request', etc. </summary>
    /// <param name="namedObjectDefCollection"> Collection of NamedObjectDefinition objects. </param>
    /// <param name="context"> A list of ObjectContext objects. </param>
    /// <returns> NamedObjectRegistry </returns>
    public static fromDefinition(
        scope: string,
        namedObjectDefCollection: NamedObjectDef[],
        context: ObjectContext): NamedObjectRegistry {

        let registry = new NamedObjectRegistry();
        if (namedObjectDefCollection != null) {
            for (let def of namedObjectDefCollection) {
                let value = context.create(def.value);
                registry.insert({
                    def: def,
                    value: value,
                    scope: scope
                });
            }
        }
        return registry;
    }
}

/// <summary> Dependency information on types, object and providers. 
/// When type, object, provider override happens at request time,
/// We use this information to determine if a named object needs to be invalidated at request time.
/// We only analyze dependency information for named objects registered at application level,
/// as request level named object anyway will be re-created.
/// </summary>
export class ObjectContextDependency {
    private _dependentTypesNames: Set<string> = new Set<string>();
    private _dependentObjectNames: Set<string> = new Set<string>(); 
    private _dependentProtocolNames: Set<string> = new Set<string>();

    /// <summary> Set a depenency on a object type </summary>
    public setTypeDependency(typeName: string) {
        this._dependentTypesNames.add(typeName);
    }

    /// <summary> Set a depenency on a URI protocol. </summary>
    public setProtocolDependency(protocolName: string) {
        this._dependentProtocolNames.add(protocolName);
    }

    /// <summary> Set a depenency on a named object. </summary>
    public setObjectDependency(objectName: string) {
        this._dependentObjectNames.add(objectName);
    }

    /// <summary> Get all dependent type names. </summary>
    public get typeDependencies(): Set<string> {
        return this._dependentTypesNames;
    }

    /// <summary> Get all dependent URI protocol names. </summary>
    public get protocolDependencies(): Set<string> {
        return this._dependentProtocolNames;
    }

    /// <summary> Get all dependent object names. </summary>
    public get objectDependencies(): Set<string> {
        return this._dependentObjectNames;
    }
};


const SCHEMA_DIR: string = path.resolve(__dirname, '../schema');  

/// <summary> Helper class to read NamedObjectDefinition array from config. </summary>
export class NamedObjectConfig {
    /// <summary> JSON schema used to validate conf. </summary>
    static readonly NAMED_OBJECT_CONFIG_SCHEMA: utils.JsonSchema = 
        new utils.JsonSchema(path.resolve(SCHEMA_DIR, "named-object-config.schema.json"));

    /// <summary> Transform object from JSON to object. </summary>
    private static _transform: utils.Transform =
        new utils.SetDefaultValue({
            'override': false,
            'private': false
        });

    /// <summary> Create NamedObjectDefinition array from a JS object array that conform with schema.
    /// Throw exception if JS object array doesn't match schema.
    /// Schema: "../schema/named-object-config.schema.json"
    /// </summary>
    /// <param name="jsValue"> a JS value array to create NamedObjectDefinition object. </param>
    /// <param name="validateSchema"> Whether validate schema, 
    /// this option is given due to request object already checked schema at request level. </param>
    /// <returns> A list of NamedObjectDefinition objects. </returns>
    public static fromConfigObject(jsValue: any[], validateSchema: boolean = true): NamedObjectDef[]{
        if (validateSchema) {
            utils.ensureSchema(jsValue, this.NAMED_OBJECT_CONFIG_SCHEMA);
        }

        jsValue.forEach(obj => {
            this._transform.apply(obj);
        });
        return jsValue;
    }

    /// <summary> Create NamedObjectDefinition array from a configuration file. (.config or .json)
    /// Throw exception if configuration file parse failed or doesn't match schema.
    /// Schema: "../schema/named-object-config.schema.json"
    /// </summary>
    /// <param name="namedObjectConfigFile"> a JSON file in named object definition schema. </param>
    /// <returns> A list of NamedObjectDefinition objects. </returns>
    public static fromConfig(namedObjectConfigFile: string): NamedObjectDef[] {
        return utils.appendMessageOnException(
            "Error found in named object definition file '" + namedObjectConfigFile + "'.",
            () => { return this.fromConfigObject(utils.readConfig(namedObjectConfigFile)); });
    }
}