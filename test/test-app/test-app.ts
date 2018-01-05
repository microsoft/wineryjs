// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { RequestContext } from '../../lib/request-context';
import { Uri } from '../../lib/object-provider';

export namespace types {
    export function createA(input: {_type: "TypeA", value: string}): string {
        return "A:" + input.value;
    }

    export function createB_app(input: {_type: "TypeB", value: string}): string {
        return "B:app:" + input.value;
    }

    export function createB_l0(input: {_type: "TypeB", value: string}): string {
        return "B:l0:" + input.value;
    }

    export function createB_l1(input: {_type: "TypeC", value: string}): string {
        return "B:l1:" + input.value;
    }

    export function createB_request(input: {_type: "TypeC", value: string}): string {
        return "B:request:" + input.value;
    }

    export function createC_app(input: {_type: "TypeC", value: string}): string {
        return "C:app:" + input.value;
    }

    export function createC_l1(input: {_type: "TypeC", value: string}): string {
        return "C:l1:" + input.value;
    }

    export function createC_request(input: {_type: "TypeC", value: string}): string {
        return "C:request:" + input.value;
    }

    export function createD_l0(input: {_type: "TypeD", value: string}): string {
        return "D:l0:" + input.value;
    }

    export function createD_request(input: {_type: "TypeD", value: string}): string {
        return "D:request:" + input.value;
    }

    export function createE(input: {_type: "TypeE", value: string}): string {
        return "E:" + input.value;
    }

    export function createX_l0(input: {_type: "TypeE", value: string}): string {
        return "X:l0:" + input.value;
    }

    export function createX_l1(input: {_type: "TypeE", value: string}): string {
        return "X:l1:" + input.value;
    }
}

export namespace providers {
    export function provideA(uri: Uri): string {
        return "A:" + uri.path;
    }

    export function provideB_app(uri: Uri): string {
        return "B:app:" + uri.path;
    }

    export function provideB_l0(uri: Uri): string {
        return "B:l0:" + uri.path;
    }
    
    export function provideB_l1(uri: Uri): string {
        return "B:l1:" + uri.path;
    }

    export function provideB_request(uri: Uri): string {
        return "B:request:" + uri.path;
    }

    export function provideC_app(uri: Uri): string {
        return "C:app:" + uri.path;
    }

    export function provideC_l1(uri: Uri): string {
        return "C:l1:" + uri.path;
    }

    export function provideC_request(uri: Uri): string {
        return "C:request:" + uri.path;
    }

    export function provideD_l0(uri: Uri): string {
        return "D:l0:" + uri.path;
    }

    export function provideD_request(uri: Uri): string {
        return "D:request:" + uri.path;
    }

    export function provideE(uri: Uri): string {
        return "E:" + uri.path;
    }

    export function provideX_l0(uri: Uri): string {
        return "X:l0:" + uri.path;
    }

    export function provideX_l1(uri: Uri): string {
        return "X:l1:" + uri.path;
    }
}

export namespace entrypoints {
    export function foo(context: RequestContext, input: string): string {
        return input;
    }

    export function bar(context: RequestContext, input: string): Promise<string> {
        return new Promise(resolve => {
            setTimeout(() => {
                resolve(input);
            }, 20);
        });
    }

    export function alwaysThrow() {
        throw new Error("You hit an always-throw entrypoint.");
    }
}