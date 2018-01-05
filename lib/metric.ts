// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as path from 'path';
import {metric} from 'napajs';
import * as utils from './utils';

/// <summary> Interface for metric collection. </summary>
export type MetricCollection = { [name: string]: metric.Metric };

/// <summary> Class for Metric definition. </summary>
export interface MetricDef {
    /// <summary> Name used to access this metric via context.metric['<name>'] </summary>
    name: string;

    /// <summary> Section e for the metric, which is passed to create the metric. </summary>
    sectionName: string;

    /// <summary> Display name for the metric, which is passed to create the metric. </summary>
    displayName: string;

    /// <summary> Description for this metric. For human consumption purpose. </summary>
    description?: string;

    /// <summary> Metric type. </summary>
    type: metric.MetricType;

    /// <summary> Dimension definitions. </summary>
    dimensionNames?: string[];
}

const SCHEMA_DIR: string = path.resolve(__dirname, '../schema');

/// <summary> Helper class to read MetricDefinition array from config. </summary>
export class MetricConfig {
    /// <summary> JSON schema used to validate config. </summary>
    private static readonly METRIC_CONFIG_SCHEMA: utils.JsonSchema 
        = new utils.JsonSchema(path.resolve(SCHEMA_DIR, "metric-config.schema.json"));

    /// <summary> Transform object from JSON to object. </summary>
    private static _transform: utils.Transform =
        new utils.SetDefaultValue( {
            'dimensionNames': []
        }).add(
        new utils.TransformPropertyValues({
            'type': (metricTypeName: string) => {
                let lowerCaseTypeName = metricTypeName.toLowerCase();
                switch (lowerCaseTypeName) {
                    case 'number': return metric.MetricType.Number;
                    case 'rate': return metric.MetricType.Rate;
                    case 'percentile': return metric.MetricType.Percentile;
                    default: throw new Error("Invalid metric type: '" + metricTypeName + "'.");
                }
            }
        }));

    /// <summary> Create MetricDefinition array from a JS object array that conform with schema.
    /// Throw exception if JS object array doesn't match schema.
    /// Schema: "../schema/metric-config.schema.json"
    /// </summary>
    /// <param name="sectionName"> Section name used to create counters. </param>
    /// <param name="jsValue"> a JS value array to create MetricDefinition object. </param>
    /// <returns> A list of NamedObjectDefinition objects. </returns>
    public static fromConfigObject(sectionName: string, jsValue: any[]): MetricDef[] {
        utils.ensureSchema(jsValue, this.METRIC_CONFIG_SCHEMA);
        
        jsValue.forEach(obj => {
            this._transform.apply(obj);
            obj.sectionName = sectionName;
        });
        return <MetricDef[]>(jsValue);
    }

    /// <summary> Create MetricDefinition array from a configuration file. (.config or .JSON)
    /// Throw exception if JS object array doesn't match schema.
    /// Schema: "../schema/metric-config.schema.json"
    /// </summary>
    /// <param name="metricConfigFile"> a .config or .JSON file in metric definition schema. </param>
    /// <returns> A list of MetricDefinition objects. </returns>
    public static fromConfig(sectionName: string, metricConfigFile: string): MetricDef[] {
        return utils.appendMessageOnException(
            "Error found in metric definition file '" + metricConfigFile + "'.",
            () => { return this.fromConfigObject(sectionName, utils.readConfig(metricConfigFile)); });
    }
}

/// <summary> Create metric collection from metric definitions. </summary>
export function createMetricCollection(defs: MetricDef[]): MetricCollection {
    let metrics: MetricCollection = {};
    for (let m of defs) {
        metrics[m.name] = metric.get(
            m.sectionName,
            m.displayName,
            m.type,
            m.dimensionNames);
    }
    return metrics;
}