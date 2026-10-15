import test from 'node:test';import assert from 'node:assert/strict';import {telemetryStats} from '../public/mission.js';
test('telemetry quantile uses observed sample values',()=>{assert.deepEqual(telemetryStats([{latency_ms:30,status:'completed'},{latency_ms:100,status:'failed'},{latency_ms:200,status:'completed'}],90),{samples:3,errors:1,p95:200,over:2})});
test('telemetry reports absent samples without synthetic latency',()=>{assert.deepEqual(telemetryStats([],200),{samples:0,errors:0,p95:null,over:0})});
