// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as assert from 'assert';
import { 
    ScopedObjectContextDef, 
    ScopedObjectContext, 
    TypeDef, 
    ProviderDef, 
    NamedObjectDef, 
    NamedObject, 
    ObjectContext, 
    Uri 
} from '../lib/object-model';

describe('winery/object-context', () => {
    let perAppContextDef: ScopedObjectContextDef = null;
    let perRequestContextDef: ScopedObjectContextDef = null;

    // Test suite for ScopedObjectContextDefinition.
    describe('ScopedObjectContextDefinition', () => {
        // Per app definitions.
        let perAppTypeDefs: TypeDef[] = [
            {
                typeName: "TypeA",
                moduleName: "./object-context-test",
                functionName: "types.createTypeA"
            },
            {
                typeName: "TypeB",
                moduleName: "./object-context-test",
                functionName: "types.createTypeB"
            }
        ];

        let perAppProviderDefs: ProviderDef[] = [
            {
                protocol: "ProtocolA",
                moduleName: "./object-context-test",
                functionName: "provideProtocolA"
            }
        ];

        let perAppObjectDefs: NamedObjectDef[] = [
            {
                name: "objectA",
                value: {
                    _type: "TypeA",
                    value: 1
                }
            },
            {
                name: "objectB",
                value: {
                    _type: "TypeB",
                    value: {
                        _type: "TypeA",
                        value: 1
                    }
                }
            },
            {
                name: "objectC",
                value: "ProtocolA://abc"
            },
        ];

        // Per request definitions.
        let perRequestTypeDefs: TypeDef[] = [
            {
                typeName: "TypeA",
                moduleName: "./object-context-test",
                functionName: "types.createTypeAPrime"
            }
        ];

        let perRequestProviderDefs: ProviderDef[] = [
            {
                protocol: "ProtocolA",
                moduleName: "./object-context-test",
                functionName: "provideProtocolAPrime"
            }
        ];

        let perRequestObjectDefs: NamedObjectDef[] = [
            {
                name: "objectA",
                value: {
                    _type: "TypeA",
                    value: 2
                }
            },
            {
                name: "objectC",
                value: "ProtocolA://cde"
            },
            {
                name: "objectD",
                value: "ProtocolA://def"
            }
        ];
        
        it("#ctor", () => {
            assert.doesNotThrow(() => {
                perAppContextDef = new ScopedObjectContextDef(null, perAppTypeDefs, perAppProviderDefs, perAppObjectDefs, true);
                perRequestContextDef = new ScopedObjectContextDef(perAppContextDef, perRequestTypeDefs, perRequestProviderDefs, perRequestObjectDefs, false);
            });
        });

        it('#getters', () => {
            assert.strictEqual(perAppContextDef.parent, null);
            assert.strictEqual(perAppContextDef.typeDefs, perAppTypeDefs);
            assert.strictEqual(perAppContextDef.providerDefs, perAppProviderDefs);
            assert.strictEqual(perAppContextDef.namedObjectDefs, perAppObjectDefs);
            
            assert.strictEqual(perAppContextDef.getTypeDef('TypeA'), perAppTypeDefs[0]);
            assert.strictEqual(perAppContextDef.getTypeDef('TypeB'), perAppTypeDefs[1]);
            assert.strictEqual(perAppContextDef.getProviderDef('ProtocolA'), perAppProviderDefs[0]);

            assert.strictEqual(perAppContextDef.getNamedObjectDef('objectA'), perAppObjectDefs[0]);
            assert.strictEqual(perAppContextDef.getNamedObjectDef('objectB'), perAppObjectDefs[1]);
            assert.strictEqual(perAppContextDef.getNamedObjectDef('objectC'), perAppObjectDefs[2]);
        });

        it('#analyzeDependency', () => {
            // objectA
            let dep1 = perAppObjectDefs[0].dependencies;
            assert(dep1.objectDependencies.size == 0);
            assert(dep1.protocolDependencies.size == 0);
            assert(dep1.typeDependencies.size == 1 && dep1.typeDependencies.has('TypeA'));

            // objectB
            let dep2 = perAppObjectDefs[1].dependencies;
            assert(dep2.objectDependencies.size == 0);
            assert(dep2.protocolDependencies.size == 0);
            assert(dep2.typeDependencies.size == 2 
                && dep2.typeDependencies.has('TypeA')
                && dep2.typeDependencies.has('TypeB'));

            // objectC
            let dep3 = perAppObjectDefs[2].dependencies;
            assert(dep3.objectDependencies.size == 0);
            assert(dep3.protocolDependencies.size == 1 && dep3.protocolDependencies.has('ProtocolA'));
            assert(dep3.typeDependencies.size == 0);
        });
    });

    // Test suite for ScopedObjectContext
    describe('ScopedObjectContext', () => {
        let perAppContext: ScopedObjectContext = null;
        let perRequestContext: ScopedObjectContext = null;
        
        it('#ctor', () => {
            perAppContext = new ScopedObjectContext("./application", __dirname, null, perAppContextDef);
            perRequestContext = new ScopedObjectContext("request", __dirname, perAppContext, perRequestContextDef);
        });

        it('#getters', () => {
            assert.strictEqual(perAppContext.scope, "./application");
            assert.strictEqual(perAppContext.baseDir, __dirname);
            assert.strictEqual(perAppContext.def, perAppContextDef);
            assert.strictEqual(perAppContext.parent, null);
            assert.strictEqual(perRequestContext.parent, perAppContext);
        });

        it('#create: overridden TypeA', () => {
            let inputA = { _type: "TypeA", value: 1};
            assert.strictEqual(perAppContext.create(inputA), 1);
            assert.strictEqual(perRequestContext.create(inputA), 2);
        });

        it('#create: not overridden TypeB', () => {
            let inputB = { _type: "TypeB", value: { _type: "TypeA", value: 1}};
            assert.strictEqual(perAppContext.create(inputB), 1);
            // B returns A's value, which is different from per-app and per-request.
            assert.strictEqual(perRequestContext.create(inputB), 2);
        });

        it('#create: overridden ProtocolA', () => {
            let uri = "ProtocolA://abc";
            assert.strictEqual(perAppContext.create(uri), "/abc");
            assert.strictEqual(perRequestContext.create(uri), "/abc*");
        });

        it('#get: overriden objectA', () => {
            let objectA = perAppContext.get('objectA');
            assert.strictEqual(objectA.scope, './application');
            assert.strictEqual(objectA.value, 1);

            objectA = perRequestContext.get('objectA');
            assert.strictEqual(objectA.scope, 'request');
            assert.strictEqual(objectA.value, 3);
        });

        it('#get: not overridden objectB but depenent types has been overridden', () => {
            let objectB = perAppContext.get('objectB');
            assert.strictEqual(objectB.scope, './application');
            assert.strictEqual(objectB.value, 1);

            /// object B
            objectB = perRequestContext.get('objectB');
            assert.strictEqual(objectB.scope, 'request');
            assert.strictEqual(objectB.value, 2);
        });

        it('#get: overriden objectC with new providerA', () => {
            let objectC = perAppContext.get('objectC');
            assert.strictEqual(objectC.scope, './application');
            assert.strictEqual(objectC.value, '/abc');

            objectC = perRequestContext.get('objectC');
            assert.strictEqual(objectC.scope, 'request');
            assert.strictEqual(objectC.value, '/cde*');
        });

        it('#get: new objectD with new providerA', () => {
            let objectD = perAppContext.get('objectD');
            assert(objectD == null);

            objectD = perRequestContext.get('objectD');
            assert.strictEqual(objectD.scope, 'request');
            assert.strictEqual(objectD.value, '/def*');
        });

        it('#forEach: without parent scope', () => {
            let objectNames: string[] = []
            perAppContext.forEach(object => {
                objectNames.push(object.def.name);
            });
            assert.strictEqual(objectNames.length, 3);
            assert(objectNames.indexOf('objectA') >= 0);
            assert(objectNames.indexOf('objectB') >= 0);
            assert(objectNames.indexOf('objectC') >= 0);
        });

        it('#forEach: with parent scope', () => {
            let objectCount = 0;
            let objectByName = new Map<string, NamedObject>();
            perRequestContext.forEach(object => {
                ++objectCount;
                objectByName.set(object.def.name, object);
                if (object.def.name !== 'objectB') {
                    assert(object.scope === 'request');
                }
            });
            assert.strictEqual(objectCount, 4);
            assert.strictEqual(objectByName.size, objectCount);
            assert(objectByName.has('objectA') && objectByName.get('objectA').scope === 'request');
            assert(objectByName.has('objectB') && objectByName.get('objectB').scope === 'request');
            assert(objectByName.has('objectC') && objectByName.get('objectC').scope === 'request');
            assert(objectByName.has('objectD') && objectByName.get('objectD').scope === 'request');
        });

        // TODO: Add test for needsUpdate.
        it('#needsUpdate');
    });
});

export type TypeAInput = { _type: "TypeA", value: number};

// Test calling function with 
export namespace types {
    export function createTypeA(input: TypeAInput | TypeAInput[]) {
        if (Array.isArray(input)) {
            return input.map(elem => elem.value);
        }
        return input.value;
    }

   export function createTypeAPrime(input: TypeAInput | TypeAInput[]) {
        if (Array.isArray(input)) {
            return input.map(elem => elem.value + 1);
        }
        return input.value + 1;
    }

    export function createTypeB(input: TypeBInput, context: ObjectContext) {
        return context.create(input.value);
    }
}

export type TypeBInput = { _type: "TypeB", value: TypeAInput};

export function provideProtocolA(uri: Uri): any {
    return uri.path;
}

export function provideProtocolAPrime(uri: Uri): any {
    return uri.path + '*';
}