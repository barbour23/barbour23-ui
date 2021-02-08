import cdk = require('@aws-cdk/core');
import s3 = require('@aws-cdk/aws-s3');
import s3deploy = require('@aws-cdk/aws-s3-deployment');
import cloudfront = require('@aws-cdk/aws-cloudfront');
import route53 = require('@aws-cdk/aws-route53');

import { DnsValidatedCertificate } from '@aws-cdk/aws-certificatemanager';
import { CloudFrontTarget } from '@aws-cdk/aws-route53-targets';

export class CdkStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const domainName = 'barbour23.com';
    const websiteIndexDocument = 'index.html';
    const websiteErrorDocument = 'error.html';

    // S3
    const websiteBucket = new s3.Bucket(this, 'Bucket', {
      bucketName: `${domainName}-hosting`,
      websiteIndexDocument: websiteIndexDocument,
      websiteErrorDocument: websiteErrorDocument,
      encryption: s3.BucketEncryption.S3_MANAGED,
      publicReadAccess: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    // Route53
    const hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
      domainName: domainName
    });
    const certificate = new DnsValidatedCertificate(this, 'Certificate', {
      // Region must be us-east-1 here.
      region: 'us-east-1',
      hostedZone: hostedZone,
      domainName: domainName
    });

    // CloudFront
    const accessIdentity = new cloudfront.OriginAccessIdentity(this, 'OriginAccessIdentity', {
      comment: `${websiteBucket.bucketName}-access-identity`
    });
    const distribution = new cloudfront.CloudFrontWebDistribution(this, 'CloudFrontDistribution', {
      originConfigs: [{
        s3OriginSource: {
          s3BucketSource: websiteBucket,
          originAccessIdentity: accessIdentity,
        },
        behaviors: [{ isDefaultBehavior: true }],
      }],
      // We need to redirect all unknown routes back to index.html for Angular routing to work.
      errorConfigurations: [{
        errorCode: 403,
        responsePagePath: `/${websiteErrorDocument}`,
        responseCode: 200,
      },
      {
        errorCode: 404,
        responsePagePath: `/${websiteErrorDocument}`,
        responseCode: 200,
      }],
      viewerCertificate: cloudfront.ViewerCertificate.fromAcmCertificate(certificate, {
        aliases: [domainName],
      })
    });

    // S3 Deployment with CloudFront distribution
    new s3deploy.BucketDeployment(this, 'BucketDeployment', {
      sources: [s3deploy.Source.asset('../website/dist/website')],
      destinationBucket: websiteBucket,
      // Invalidate the cache for / and index.html when we deploy so that CloudFront serves latest site.
      distribution: distribution,
      distributionPaths: ['/', `/${websiteIndexDocument}`, `/${websiteErrorDocument}`]
    });

    // Route53 ARecords
    const cloudfrontTarget = route53.RecordTarget.fromAlias(new CloudFrontTarget(distribution));
    new route53.ARecord(this, 'ARecord', {
        zone: hostedZone,
        recordName: domainName,
        target: cloudfrontTarget
    });

    // CloudFront domain output
    new cdk.CfnOutput(this, 'CloudFront domain', {
      description: 'The CloudFront domain of the website',
      value: distribution.distributionDomainName
    });
  }
}
