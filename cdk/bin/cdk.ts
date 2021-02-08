#!/usr/bin/env node
import 'source-map-support/register';
import cdk = require('@aws-cdk/core');
import { CdkStack } from '../lib/cdk-stack';

const app = new cdk.App();
new CdkStack(app, 'Barbour23UI', {
    env: {
        account: '616615082738',
        region: 'eu-west-2'
    }
});
