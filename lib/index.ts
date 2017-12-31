// Export core entities in flattened namespace.
export { Host } from "./host";
export * from './app'
export * from './object-model'
export * from './wire'

// Export misc entities in sub namespaces.
import * as builtins from './builtins';
import * as config from './config';
import * as utils from './utils'

export { builtins, config, utils };

import * as path from 'path';
import { Host, Hub } from './host';

/// <summary> A global host instance. </summary>
let _host: Host = undefined;

/// <summary> Create or get a hub. </summary>
export function hub(): Host {
    if (_host == null) {
        _host = new Hub(config.HostConfig.fromConfig(
            path.resolve(__dirname, "../config/host.json")));
    }
    return _host;
}