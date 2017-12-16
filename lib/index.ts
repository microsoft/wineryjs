// Export user types to a flattened namespace.
import * as objectModel from './object-model';
import * as builtins from './builtins';
import * as config from './config';
import * as utils from './utils'
import * as host from './host';

export {builtins, config, host, objectModel, utils};
export * from './app'
export * from './wire'

import { Request, Response} from './wire';
import * as path from 'path';
import * as napa from 'napajs';

/// <summary> A global host instance. </summary>
let _host: host.Host = undefined;
let _hostSettings = config.HostConfig.fromConfig(
    path.resolve(__dirname, "../config/host.json"));

/// <summary> Initialize host on demand. </summary>
function initHost() {
    _host = new host.HostHub(_hostSettings);
}

/// <summary> Register a winery application. </summary>
/// <param name="appModuleName"> Module name for winery application, which contains an app.json under the path. </param>
/// <param name="appInstanceNames"> A list of names used to serve application, which correspond to 'application' property in Request. </param>
/// <param name="zone"> Optional. Napa zone to run the application, if not specified, run application in current V8 isolate. </param>
/// <returns> Returns a promise of void which will be resolved when register completes. If error happens, promise will be rejected with exception. </returns>
export function register(
    appModuleName: string, 
    appInstanceNames: string[], 
    zone: napa.zone.Zone = null): Promise<void> {

    // If module is in relative path, figure out the full path from caller directory name.
    if (appModuleName.startsWith('.')) {
        let callSites = napa.v8.currentStack(2);
        if (callSites.length > 1) {
            appModuleName = path.resolve(path.dirname(callSites[1].getFileName()), appModuleName);
        }
    }

    let appModulePath: string = path.dirname(require.resolve(appModuleName + '/app.json'));

    // Lazy creation of host when register is called at the first time.
    if (_host == null) {
        initHost();
    }

    return _host.register(
        appModulePath, 
        appInstanceNames, 
        zone);
}

/// <summary> Serve a request with a promise of response. </summary>
/// <param name="request"> Requet in form of a JSON string or Request object. </param>
/// <returns> A promise of Response. This function call may be synchrous or asynchrous depending on the entrypoint. </returns>
export async function serve(
    request: string | Request): Promise<Response> {
    return await _host.serve(request);
}

/// <summary> Get all application names served by current host. </summary>
export function getApplicationInstanceNames(): string[] {
    return _host.applicationInstanceNames;
}