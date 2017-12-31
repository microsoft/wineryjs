// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

/////////////////////////////////////////////////////////////////////
// This file defines built-in entrypoints in winery module.

import * as fs from 'fs';
import { hub, RequestContext, TypeDef, ProviderDef, NamedObjectDef } from './index';

/// <summary> List all application names in current system. </summary>
export function listApplications(request: RequestContext): string[] {
    return hub().applicationInstanceNames;
}

const DEFAULT_RANK_USER_ENTRYPOINT: number = 700; 

/// <summary> List all entry point names under current application. </summary>
export function listEntryPoints(
    request: RequestContext,
    input: { detail: boolean, allowGlobal: boolean, allowPrivate: boolean } 
        = { detail: false, allowGlobal: true, allowPrivate: false }
        ): string[] | NamedObjectDef[] {

    let entryPointDefs: NamedObjectDef[] = [];
    request.application.objectContext.forEach(namedObject => {
        let def = namedObject.def;
        if (def.value._type === 'EntryPoint'
            && (input.allowPrivate || !namedObject.def.private)
            && (input.allowGlobal || namedObject.scope !== "global")) {
            entryPointDefs.push(namedObject.def);
        }
    });

    // Rank entrypoint by displayRank first and then alphabetical order.
    entryPointDefs = entryPointDefs.sort((a, b): number => {
        let rankA = isNaN(a.value['displayRank']) ? DEFAULT_RANK_USER_ENTRYPOINT : a.value['displayRank'];
        let rankB = isNaN(b.value['displayRank']) ? DEFAULT_RANK_USER_ENTRYPOINT : b.value['displayRank'];

        if (rankA != rankB) {
            return rankA - rankB;
        }

        // Name should never be equal.
        return a.name < b.name ? -1 : 1;
    });
    return input.detail ? entryPointDefs
        : entryPointDefs.map((def) => {
            return def.name
        });
}

/// <summary> List all named objects under current application. </summary>
export function listNamedObjects(
    request: RequestContext,
    input: { allowPrivate: boolean, scopes: string[] } = { allowPrivate: false, scopes: ['request', 'application']}): string[] {
    
    let objectNames: string[] = [];
    request.application.objectContext.forEach(namedObject => {
        if ((input.allowPrivate || !namedObject.def.private)
        && (namedObject.scope in input.scopes)) {
            objectNames.push(namedObject.def.name);
        }
    });
    return objectNames;
}

/// <summary> Display a named object by name. </summary>
export function getNamedObject(request: RequestContext, input: { name: string }): any {
    if (input == null || input.name == null) {
        throw new Error("'name' property must be specified under 'input' object of request.");
    }

    let object = request.getNamedObject(input.name);
    if (object == null || object.def == null) {
        return null;
    }

    return object.def;
}

/// <summary> List all types supported in current application. </summary>
/// TODO: @dapeng, return types from global and request scope.
export function listTypes(request: RequestContext): string[] {
    let appDef = request.application.settings;
    let typeNames: string[] = [];
    for (let typeDef of appDef.objectContextDef.typeDefs) {
        typeNames.push(typeDef.typeName);
    }
    return typeNames;
}

/// <summary> Get definition of a type in current application. </summary>
/// TODO: @dapeng, return types from global and request scope.
export function getType(request: RequestContext, input: { typeName: string }): TypeDef {
    if (input == null || input.typeName == null) {
        throw new Error("'typeName' property must be specified under 'input' object of request.");
    }

    let appDef = request.application.settings;
    let types = appDef.objectContextDef.typeDefs;
    for (let i = 0; i < types.length; i++){
        if (types[i].typeName.toLowerCase() == input.typeName.toLowerCase()) {
            return types[i];
        }
    }

    throw new Error("Type name '" + input.typeName + "' is not supported in current application.");
}

/// <summary> List URI providers supported in current application. </summary>
/// TODO: @dapeng, return providers from global and request scope.
export function listProviders(request: RequestContext): string[] {
    let appDef = request.application.settings;
    let protocolNames: string[] = [];
    for (let providerDef of appDef.objectContextDef.providerDefs) {
        protocolNames.push(providerDef.protocol);
    }
    return protocolNames;
}

/// <summary> Get the provider definition for a URI protocol. </summary>
/// TODO: @dapeng, return providers from global and request scope.
export function getProvider(request: RequestContext, input: { protocolName: string }): ProviderDef {
    if (input == null || input.protocolName == null) {
        throw new Error("'protocolName' property must be specified under 'input' object of request.");
    }

    let appDef = request.application.settings;
    let providers = appDef.objectContextDef.providerDefs;
    for (let provider of providers) {
        if (provider.protocol.toLowerCase() === input.protocolName.toLowerCase()) {
            return provider;
        }
    }
    throw new Error("Protocol name '" + input.protocolName + "' is not supported in current application.");
}
