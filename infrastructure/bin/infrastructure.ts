#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { AsclepiusStack } from '../lib/asclepius-stack';

const app = new cdk.App();

// Get environment configuration
const stage = app.node.tryGetContext('stage') || 'dev';
const region = app.node.tryGetContext('region') || 'us-east-1';

new AsclepiusStack(app, `Asclepius-${stage}`, {
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: region 
  },
  stage: stage,
  description: `Asclepius Healthcare AI System - ${stage} environment`
});