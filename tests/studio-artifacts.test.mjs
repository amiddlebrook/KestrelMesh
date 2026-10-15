import test from 'node:test';
import assert from 'node:assert/strict';
import {sloSnapshotFor} from '../public/studio.js';
import {downloadArtifact} from '../public/studio-export.js';
test('studio supports explicit domain-specific artifact export',()=>{assert.equal(typeof sloSnapshotFor,'function');assert.equal(typeof downloadArtifact,'function');});
test('domain report derives truthful, bounded artifacts from selected records',()=>{  const report=sloSnapshotFor({hours:24,totals:{count:2},providers:[],truncated:true,note:'sample'},'all',99);assert.equal(report.observed.count,2);assert.equal(report.sample_truncated,true); });
