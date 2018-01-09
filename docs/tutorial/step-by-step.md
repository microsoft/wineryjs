# Writing Applications

## Step 1: Coding the logics
`example-app/example.ts`
```typescript
import w = require('winery');

////////////////////////////////////////////////////////////////////////////
/// Functions for entrypoints.

/// Function for entrypoint 'echo'. 
/// See 'named-objects.json' below on how we register this entrypoint.
/// The 1st parameter is the input from request.
/// The 2nd parameter is a winery.RequestContext object.
export function echo(context: w.RequestContext, text: string) {
    return text;
}

/// Function for entrypoint 'compute', which is to compute sum on an array of numbers. 
export function compute(context: w.RequestContext, numberArray: number[]) {
    var func = (list: number[]) => {
        return list.reduce((sum: number, value: number) => {
                return sum + value;
            }, 0);
    }
    // Note: context.get will returned named object giving a name.
    var functionObject = context.get('customFunction');
    if (functionObject != null) {
        func = functionObject.value;
    }
    return func(numberArray);
}

/// Function for entrypoint 'loadObject', which return an object for the uri.
/// NOTE: We use URI to represent object that is able to reference and share more conveniently.
export function loadObject(uri: string, context: winery.RequestContext) {
    // Note: context.create will detect uri string and use registered object provider to create the object.
    return context.create(uri);
}

/// Function that will be used to provide objects for protocol 'text'.
export function createObject(input: any, context: winery.RequestContext) {
    // Note: for non-uri input, context.create will use constructor of registered object types to create it.
    return context.create(input);
}

////////////////////////////////////////////////////////////////////////////
/// Functions for object types.
TODO:

////////////////////////////////////////////////////////////////////////////
/// Functions for object providers.
TODO:

```
## Step 2: Configuring things together
`example-app/app.json` (root configuration)
```json
{
    "id": "example-app",
    "description": "Example application for winery",
    "objectTypes": ["./object-types.json"],
    "objectProviders": ["./object-providers.json"],
    "namedObjects": ["./named-objects.json"],
    "interceptors": ["./interceptors.json"],
    "metrics": {
        "sectionName": "ExampleApp",
        "definitions": ["./metrics.json"]
    }
}
```
`example-app/object-types.json` (a configuration file for objectTypes)

See [[Object Type]](#object-type).

```json
[
    {
        "typeName": "<type-name>",
        "description": "<type-description>",
        "moduleName": "<module-name>",
        "functionName": "<function-name-as-constructor>",
        "schema": "<JSON schema to check object input>"
    }
]

```

`example-app/object-providers.json` (a configuration file for objectProviders)

See [[Object Provider]](#object-provider)
```json
[
    {
        "protocol": "<protocol-name>",
        "description": "<protocol-description>",
        "moduleName": "<module-name>",
        "functionName": "<function-name-as-loader>"
    }
]

```
`example-app/named-objects.json` (a configuration file for namedObjects)

See [[Named Object]](#named-object)
```json
[
    {
        "name": "<object-name>",
        // Object value can be created by object factory or providers.
        "value": {}
    }
]

```
## Step 3 - Trying requests
```
TODO:
```