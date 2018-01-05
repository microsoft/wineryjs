// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

/////////////////////////////////////////////////////////////////////////////////////////
/// Winery.js facade

// Export core entities in flattened namespace.
export * from './application'
export * from './object-model'
export * from './request-context'
export * from './request-template'
export * from './request'
export * from './response'

export { Host, HostConfig, HostSettings } from "./host";

// Export misc entities in sub namespaces.
import * as builtins from './builtins';
export { builtins };

import * as path from 'path';
import { HostConfig, Host, Hub } from './host';

/// <summary> A global host instance. </summary>
let _host: Host = undefined;

/// <summary> Create or get a hub. </summary>
export function hub(): Host {
    if (_host == null) {
        _host = new Hub(HostConfig.fromConfig(
            path.resolve(__dirname, "../config/host.json")));
    }
    return _host;
}