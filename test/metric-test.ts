// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as assert from 'assert';
import * as path from 'path';
import { metric } from 'napajs';
import { MetricConfig } from '../lib/metric';

describe('winery/metric', () => {
    describe('MetricConfig', () => {
        it('#fromConfigObject: good config', () => {
            let configObject = [
                {
                    name: "myCounter1",
                    displayName: "My counter1",
                    description: "Counter description",
                    type: "Percentile",
                    dimensionNames: ["d1", "d2"]
                },
                {
                    name: "myCounter2",
                    displayName: "My counter2",
                    description: "Counter description",
                    type: "Rate",
                    dimensionNames: []
                },
                {
                    name: "myCounter3",
                    displayName: "My counter3",
                    description: "Counter description",
                    type: "Number",
                    dimensionNames: []
                }
            ]
            let defs = MetricConfig.fromConfigObject("DefaultSection", configObject);
            assert.deepEqual(defs, [
                {
                    name: "myCounter1",
                    sectionName: "DefaultSection",
                    displayName: "My counter1",
                    description: "Counter description",
                    type: metric.MetricType.Percentile,
                    dimensionNames: ["d1", "d2"]
                },
                {
                    name: "myCounter2",
                    sectionName: "DefaultSection",
                    displayName: "My counter2",
                    description: "Counter description",
                    type: metric.MetricType.Rate,
                    dimensionNames: []
                },
                {
                    name: "myCounter3",
                    sectionName: "DefaultSection",
                    displayName: "My counter3",
                    description: "Counter description",
                    type: metric.MetricType.Number,
                    dimensionNames: []
                }
            ])
        });

        it ('#fromConfig', () => {
            assert.doesNotThrow(() => {
                MetricConfig.fromConfig("DefaultSection",
                    path.resolve(__dirname, "test-app/metrics.json"));
            });
        });
    });
});
