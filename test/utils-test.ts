// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as utils from '../lib/utils';
import * as path from 'path';
import * as assert from 'assert';

describe('winery/utils', () => {
    let schema = new utils.JsonSchema(
        path.resolve(__dirname, 'config/utils-test.schema.json'));

    describe('JsonSchema', () => {
        it('#validate: valid input', () => {
            assert(schema.validate({
                stringProp: "hello world",
                numberProp: 0,
                booleanProp: true,
                arrayProp: [1, 2],
                objectProp: {
                    field1: 1,
                    additionalField: "additional"
                }
            }));
        });

        it('#validate: wrong type', () => {
            assert(!schema.validate({
                stringProp: 1,
                numberProp: 0,
                booleanProp: true,
                arrayProp: [1, 2],
                objectProp: {
                    field1: 1,
                    additionalField: "additional"
                }
            }));
        });

        it('#validate: missing required properties', () => {
            assert(!schema.validate({
                numberProp: 0,
                booleanProp: true,
                arrayProp: [1, 2],
                objectProp: {
                    field1: 1,
                }
            }));
        });
        it('#validate: not-allowed additional properties', () => {
            assert(!schema.validate({
                stringProp: "hello world",
                numberProp: 0,
                booleanProp: true,
                notAllowedExtra: "extra",
                arrayProp: [1, 2],
                objectProp: {
                    field1: 1,
                    additionalField: "additional"
                }
            }));
        });
    });

    describe('Json reading', () => {
        it('#parseJsonString: valid string, no schema check', () => {
            let value = utils.parseJsonString('{ "prop": 1 }');
            assert.equal(value.prop, 1);
        });

        it('#parseJsonString: valid string, comform with schema', () => {
            let jsonString = `
            {
                "stringProp": "hi",
                "numberProp": 0,
                "booleanProp": true,
                "arrayProp": [
                    1,
                    2
                ],
                "objectProp": {
                    "field1": 1
                }
            }
            `;

            let value: any = undefined;
            assert.doesNotThrow(() => {
                value = utils.parseJsonString(jsonString, schema);
            });
            assert.equal(value.stringProp, 'hi');
            assert.equal(value.numberProp, 0);
            assert.equal(value.booleanProp, true);
            assert.deepEqual(value.arrayProp, [1, 2]);
            assert.deepEqual(value.objectProp, {
                field1: 1
            });
        });

        it('#parseJsonString: valid string, not comform with schema', () => {
            // Missing 'stringProp'.
            let jsonString = `
            {
                "numberProp": 0,
                "booleanProp": true,
                "arrayProp": [
                    1,
                    2
                ],
                "objectProp": {
                    "field1": 1
                }
            }
            `;

            assert.throws(() => {
                utils.parseJsonString(jsonString, schema);
            });
        });

        it('#parseJsonString: allow comments', () => {
            let jsonString = `
            {
                // This is a comment.
                "prop": 0
            }
            `;
            let value: any = undefined;
            //assert.doesNotThrow(() => {
                value = utils.parseJsonString(jsonString, null, true);
            //});
            assert.equal(value.prop, 0);
        });

        it('#parseJsonString: not allow comments', () => {
            let jsonString = `
            {
                // This is a comment.
                "prop": 0
            }
            `;
            assert.throws(() => {
                utils.parseJsonString(jsonString, null, false);
            });
        });

        it('#parseJsonString: invalid JSON string', () => {
            let jsonString = `
            {
                "prop": 0,
            }
            `;
            assert.throws(() => {
                utils.parseJsonString(jsonString);
            });
        });

        it('#parseJsonFile', () => {
            let value: any = undefined;

            assert.doesNotThrow(() => {
                value = utils.parseJsonFile(
                    path.resolve(__dirname, "config/utils-test.json"),
                    schema,
                    true);
            });
            assert.equal(value.stringProp, 'hi');
            assert.equal(value.numberProp, 0);
            assert.equal(value.booleanProp, true);
            assert.deepEqual(value.arrayProp, [1, 2]);
            assert.deepEqual(value.objectProp, {
                field1: 1,
                additionalField: "additional"
            });
        });
    });

    describe('Transform', () => {
        it('#RenameProperties', () => {
            let value: any = {
                strProp: "value",
                numProp: 1
            };
            value = new utils.RenameProperties( {
                strProp: "stringProp",
                numProp: "numberProp"
            }).apply(value);

            assert.strictEqual(value.stringProp, "value");
            assert.strictEqual(value.numberProp, 1);
        });

        it('#SetDefaultValue', () => {
            let value: any = {
                stringProp: "value"
            };
            value = new utils.SetDefaultValue( {
                optionalProp: true
            }).apply(value);

            assert.strictEqual(value.optionalProp, true);
        });

        it('#TransformPropertyValues', () => {
            let value: any = {
                stringProp: "1"
            };
            value = new utils.TransformPropertyValues( {
                stringProp: (text: string) => { return Number.parseInt(text); }
            }).apply(value);

            assert.strictEqual(value.stringProp, 1);
        });

        it('#ChainableTransform', () => {
            let value: any = {
                strProp: "1"
            };

            value = new utils.RenameProperties( { strProp: "stringProp"}).add(
                new utils.SetDefaultValue( {optionalProp: true})).add(
                new utils.TransformPropertyValues( {
                    stringProp: (text: string) => { return Number.parseInt(text);}
                })).apply(value);

            assert.deepEqual(value, {
                stringProp: 1,
                optionalProp: true
            });
        })
    });

    describe('Miscs', () => {
        it('#appendMessageOnException', () => {
            let extraMessage = "extra message.";
            try {
                utils.appendMessageOnException(extraMessage, () => {
                    throw new Error("intentional error.");
                })
            }
            catch (error) {
                console.log(error.message);
                assert(error.message.endsWith(extraMessage));
            }
        });

        it('#makePromiseIfNotAlready', () => {
            let funcReturnsPromise = (): Promise<number> => {
                return Promise.resolve(1);
            };

            let funcDoesnotReturnsPromise = (): number => {
                return 1;
            }   

            let ret1 = utils.makePromiseIfNotAlready(funcReturnsPromise());
            ret1.then((value: number) => {
                assert.equal(value, 1);
            });

            let ret2 = utils.makePromiseIfNotAlready(funcDoesnotReturnsPromise());
            ret2.then((value: number) => {
                assert.equal(value, 1);
            })
        });

        it('#loadFunction', () => {
            let moduleName = path.resolve(__dirname, 'utils-test');
            let f1 = utils.loadFunction(moduleName, "func1");
            assert.equal(func1, f1);
            
            let f2 = utils.loadFunction(moduleName, 'ns.func2');
            assert.equal(ns.func2, f2);

            let f3 = utils.loadFunction(moduleName, 'ns.child.func3');
            assert.equal(ns.child.func3, f3);

            let f4 = utils.loadFunction(moduleName, 'ns.A.method');
            assert.equal(ns.A.method, f4);
        });
    });
});

/// Functions for testing utils.loadFunction.
export function func1(): number {
    return 0;
}

export namespace ns {
    export function func2(): void {
    }

    export namespace child {
        export function func3(): void {
        }
    }

    export class A {
        public static method(): void {
        }
    }
}