import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as stepfunctions from 'aws-cdk-lib/aws-stepfunctions';
import * as stepfunctionsTasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as fs from 'fs';
import * as path from 'path';

export interface AsclepiusStackProps extends cdk.StackProps {
  stage: string;
}

export class AsclepiusStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AsclepiusStackProps) {
    super(scope, id, props);

    const { stage } = props;

    // ===========================================
    // CDK Parameters - Certificate Required for HealthScribe
    // ===========================================
    const certificateArn = new cdk.CfnParameter(this, 'CertificateArn', {
      type: 'String',
      description: 'ARN of the ACM certificate for HTTPS/WSS support (REQUIRED for HealthScribe API)',
      constraintDescription: 'Must provide a valid ACM certificate ARN. HealthScribe requires HTTPS.',
      minLength: 20, // Basic validation for ARN format
    });

    const domainName = new cdk.CfnParameter(this, 'DomainName', {
      type: 'String',
      description: 'Custom domain name for the ALB (optional - will use ALB DNS if not provided)',
      default: '',
    });

    // ===========================================
    // VPC and Networking
    // ===========================================
    const vpc = new ec2.Vpc(this, 'AsclepiusVpc', {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
    });

    // ===========================================
    // DynamoDB Tables
    // ===========================================

    // Main visit data table (AI analysis results)
    const visitDataTable = new dynamodb.Table(this, 'VisitDataTable', {
      tableName: `asclepius-visit-data-${stage}`,
      partitionKey: { name: 'visitId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'dataCategory', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: stage === 'prod',
      },
    });

    // Patient information table
    const patientTable = new dynamodb.Table(this, 'PatientTable', {
      tableName: `asclepius-patient-${stage}`,
      partitionKey: { name: 'patientID', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: stage === 'prod',
      },
    });

    // Visit records table
    const visitTable = new dynamodb.Table(this, 'VisitTable', {
      tableName: `asclepius-visit-${stage}`,
      partitionKey: { name: 'visitID', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: stage === 'prod',
      },
    });

    // Transcript/conversation table
    const transcriptTable = new dynamodb.Table(this, 'TranscriptTable', {
      tableName: `asclepius-transcript-${stage}`,
      partitionKey: { name: 'visitID', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: stage === 'prod',
      },
    });

    // ===========================================
    // S3 Bucket for Audio Recordings
    // ===========================================
    const audioBucket = new s3.Bucket(this, 'AudioRecordingsBucket', {
      bucketName: `asclepius-audio-${stage}-${this.account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: stage === 'prod',
      autoDeleteObjects: stage !== 'prod', // Auto-delete objects in dev for easy cleanup
      lifecycleRules: [
        {
          id: 'DeleteOldRecordings',
          enabled: true,
          expiration: cdk.Duration.days(stage === 'prod' ? 2555 : 30), // 7 years for prod, 30 days for dev
        },
      ],
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // ===========================================
    // S3 Bucket for Frontend Hosting
    // ===========================================
    const frontendBucket = new s3.Bucket(this, 'FrontendBucket', {
      bucketName: `asclepius-frontend-${stage}-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL, // Keep bucket private
      autoDeleteObjects: stage !== 'prod', // Auto-delete objects in dev for easy cleanup
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // ===========================================
    // OpenSearch Domain for Knowledge Base (DISABLED FOR NOW)
    // ===========================================
    // TODO: Re-enable OpenSearch when needed for knowledge base functionality
    /*
    const openSearchDomain = new opensearchservice.Domain(this, 'KnowledgeBaseDomain', {
      version: opensearchservice.EngineVersion.OPENSEARCH_2_3,
      domainName: `asclepius-kb-${stage}`,
      capacity: {
        dataNodes: 1,
        dataNodeInstanceType: stage === 'prod' ? 'm6g.large.search' : 't3.small.search',
        multiAzWithStandbyEnabled: false, // Explicitly disable Multi-AZ
      },
      ebs: {
        volumeSize: stage === 'prod' ? 100 : 20,
        volumeType: ec2.EbsDeviceVolumeType.GP3,
      },
      vpc: vpc,
      vpcSubnets: [{ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }],
      securityGroups: [this.createOpenSearchSecurityGroup(vpc)],
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });
    */

    // ===========================================
    // Cognito User Pool for Authentication
    // ===========================================
    const userPool = new cognito.UserPool(this, 'AsclepiusUserPool', {
      userPoolName: `asclepius-users-${stage}`,
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
      },
      autoVerify: {
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    const userPoolClient = new cognito.UserPoolClient(this, 'AsclepiusUserPoolClient', {
      userPool,
      userPoolClientName: `asclepius-client-${stage}`,
      generateSecret: false, // Required for web applications
      authFlows: {
        userSrp: true,
        userPassword: true,
      },
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
        },
        scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL, cognito.OAuthScope.PROFILE],
      },
    });

    const identityPool = new cognito.CfnIdentityPool(this, 'AsclepiusIdentityPool', {
      identityPoolName: `asclepius_identity_${stage}`,
      allowUnauthenticatedIdentities: true,
      cognitoIdentityProviders: [
        {
          clientId: userPoolClient.userPoolClientId,
          providerName: userPool.userPoolProviderName,
        },
      ],
    });

    // IAM roles for authenticated and unauthenticated users
    const authenticatedRole = new iam.Role(this, 'CognitoAuthenticatedRole', {
      assumedBy: new iam.FederatedPrincipal(
        'cognito-identity.amazonaws.com',
        {
          StringEquals: {
            'cognito-identity.amazonaws.com:aud': identityPool.ref,
          },
          'ForAnyValue:StringLike': {
            'cognito-identity.amazonaws.com:amr': 'authenticated',
          },
        },
        'sts:AssumeRoleWithWebIdentity'
      ),
    });

    const unauthenticatedRole = new iam.Role(this, 'CognitoUnauthenticatedRole', {
      assumedBy: new iam.FederatedPrincipal(
        'cognito-identity.amazonaws.com',
        {
          StringEquals: {
            'cognito-identity.amazonaws.com:aud': identityPool.ref,
          },
          'ForAnyValue:StringLike': {
            'cognito-identity.amazonaws.com:amr': 'unauthenticated',
          },
        },
        'sts:AssumeRoleWithWebIdentity'
      ),
    });

    // Grant DynamoDB permissions to authenticated users
    visitDataTable.grantReadWriteData(authenticatedRole);
    patientTable.grantReadWriteData(authenticatedRole);
    visitTable.grantReadWriteData(authenticatedRole);
    transcriptTable.grantReadWriteData(authenticatedRole);

    // Attach roles to identity pool
    new cognito.CfnIdentityPoolRoleAttachment(this, 'IdentityPoolRoleAttachment', {
      identityPoolId: identityPool.ref,
      roles: {
        authenticated: authenticatedRole.roleArn,
        unauthenticated: unauthenticatedRole.roleArn,
      },
    });

    // ===========================================
    // IAM Roles
    // ===========================================
    const lambdaExecutionRole = this.createLambdaExecutionRole(visitDataTable, patientTable, visitTable, transcriptTable, audioBucket); // Removed openSearchDomain parameter
    const stepFunctionsRole = this.createStepFunctionsRole();

    // ===========================================
    // Lambda Functions
    // ===========================================
    const lambdaFunctions = this.createLambdaFunctions(lambdaExecutionRole, stage);

    // ===========================================
    // S3 Trigger for Extract Session ID Lambda
    // ===========================================
    // Add S3 notification to trigger asclepius-extract-session-id on transcript.json files
    audioBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(lambdaFunctions['asclepius-extract-session-id']),
      {
        suffix: 'transcript.json'
      }
    );

    // ===========================================
    // Step Functions Workflows
    // ===========================================
    const mainWorkflow = this.createMainWorkflowFromJson(lambdaFunctions, visitDataTable, stepFunctionsRole, stage);
    const visitDbWorkflow = this.createVisitDbWorkflowFromJson(lambdaFunctions, stepFunctionsRole, stage);

    // ===========================================
    // EventBridge Rule for Transcript Processing
    // ===========================================
    const transcriptProcessingRule = new events.Rule(this, 'TranscriptToStepFunctions', {
      ruleName: `TranscriptToStepFunctions-${stage}`,
      description: 'Triggers Step Functions workflow when transcript is processed',
      eventPattern: {
        source: ['custom.transcript'],
        detailType: ['TranscriptProcessed']
      },
      enabled: true
    });

    // Add Step Functions as targets for the EventBridge rule
    transcriptProcessingRule.addTarget(new targets.SfnStateMachine(mainWorkflow));
    transcriptProcessingRule.addTarget(new targets.SfnStateMachine(visitDbWorkflow));

    // ===========================================
    // ECS Cluster and Service
    // ===========================================
    const ecsCluster = this.createEcsCluster(
      vpc,
      stage,
      certificateArn.valueAsString,
      domainName.valueAsString,
      audioBucket,
      visitDataTable,
      patientTable,
      visitTable,
      transcriptTable
    );

    // ===========================================
    // CloudFront Distribution for Frontend
    // ===========================================
    const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'FrontendOAI', {
      comment: `OAI for Asclepius frontend ${stage}`,
    });

    // Grant CloudFront access to the private S3 bucket
    frontendBucket.grantRead(originAccessIdentity);

    const distribution = new cloudfront.Distribution(this, 'FrontendDistribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(frontendBucket, {
          originAccessIdentity: originAccessIdentity,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html', // SPA routing
        },
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html', // SPA routing
        },
      ],
    });

    // ===========================================
    // Outputs
    // ===========================================

    // Deployment stage
    new cdk.CfnOutput(this, 'DeploymentStage', {
      value: stage,
      description: 'Deployment stage (dev/prod)',
      exportName: `Asclepius-${stage}-Stage`
    });

    new cdk.CfnOutput(this, 'VpcId', {
      value: vpc.vpcId,
      description: 'VPC ID for Asclepius',
    });

    new cdk.CfnOutput(this, 'VisitDataTableName', {
      value: visitDataTable.tableName,
      description: 'DynamoDB table for AI visit data',
      exportName: `Asclepius-${stage}-VisitDataTableName`
    });

    new cdk.CfnOutput(this, 'PatientTableName', {
      value: patientTable.tableName,
      description: 'DynamoDB table for patient information',
      exportName: `Asclepius-${stage}-PatientTableName`
    });

    new cdk.CfnOutput(this, 'VisitTableName', {
      value: visitTable.tableName,
      description: 'DynamoDB table for visit records',
      exportName: `Asclepius-${stage}-VisitTableName`
    });

    new cdk.CfnOutput(this, 'TranscriptTableName', {
      value: transcriptTable.tableName,
      description: 'DynamoDB table for conversation transcripts',
      exportName: `Asclepius-${stage}-TranscriptTableName`
    });

    new cdk.CfnOutput(this, 'AudioBucketName', {
      value: audioBucket.bucketName,
      description: 'S3 bucket for audio recordings',
      exportName: `Asclepius-${stage}-AudioBucketName`
    });

    // OpenSearch output (DISABLED FOR NOW)
    /*
    new cdk.CfnOutput(this, 'OpenSearchDomainEndpoint', {
      value: openSearchDomain.domainEndpoint,
      description: 'OpenSearch domain endpoint',
    });
    */

    new cdk.CfnOutput(this, 'MainWorkflowArn', {
      value: mainWorkflow.stateMachineArn,
      description: 'Main AI workflow Step Functions ARN',
    });

    new cdk.CfnOutput(this, 'EventBridgeRuleArn', {
      value: transcriptProcessingRule.ruleArn,
      description: 'EventBridge rule ARN for transcript processing',
      exportName: `Asclepius-${stage}-EventBridgeRuleArn`
    });

    new cdk.CfnOutput(this, 'FrontendBucketName', {
      value: frontendBucket.bucketName,
      description: 'S3 bucket for frontend hosting',
      exportName: `Asclepius-${stage}-FrontendBucketName`
    });

    new cdk.CfnOutput(this, 'CloudFrontDistributionId', {
      value: distribution.distributionId,
      description: 'CloudFront distribution ID',
      exportName: `Asclepius-${stage}-CloudFrontDistributionId`
    });

    new cdk.CfnOutput(this, 'CloudFrontDomainName', {
      value: distribution.distributionDomainName,
      description: 'CloudFront distribution domain name',
      exportName: `Asclepius-${stage}-CloudFrontDomainName`
    });

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: `Asclepius-${stage}-UserPoolId`
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
      exportName: `Asclepius-${stage}-UserPoolClientId`
    });

    new cdk.CfnOutput(this, 'IdentityPoolId', {
      value: identityPool.ref,
      description: 'Cognito Identity Pool ID',
      exportName: `Asclepius-${stage}-IdentityPoolId`
    });


  }

  // OpenSearch Security Group (DISABLED FOR NOW)
  /*
  private createOpenSearchSecurityGroup(vpc: ec2.Vpc): ec2.SecurityGroup {
    const sg = new ec2.SecurityGroup(this, 'OpenSearchSecurityGroup', {
      vpc,
      description: 'Security group for OpenSearch domain',
      allowAllOutbound: true,
    });

    sg.addIngressRule(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.tcp(443),
      'Allow HTTPS from VPC'
    );

    return sg;
  }
  */

  private createLambdaExecutionRole(
    visitDataTable: dynamodb.Table,
    patientTable: dynamodb.Table,
    visitTable: dynamodb.Table,
    transcriptTable: dynamodb.Table,
    audioBucket: s3.Bucket
    // openSearchDomain: opensearchservice.Domain // DISABLED FOR NOW
  ): iam.Role {
    const role = new iam.Role(this, 'LambdaExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole'),
      ],
    });

    // DynamoDB permissions for all tables
    visitDataTable.grantReadWriteData(role);
    patientTable.grantReadWriteData(role);
    visitTable.grantReadWriteData(role);
    transcriptTable.grantReadWriteData(role);

    // Bedrock permissions
    role.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:InvokeModel',
        'bedrock:InvokeModelWithResponseStream',
      ],
      resources: ['*'],
    }));

    // HealthScribe permissions
    role.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'transcribe:StartMedicalTranscriptionJob',
        'transcribe:GetMedicalTranscriptionJob',
        'transcribe:ListMedicalTranscriptionJobs',
      ],
      resources: ['*'],
    }));

    // S3 permissions for HealthScribe and audio bucket
    audioBucket.grantReadWrite(role);
    role.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:GetObject',
        's3:PutObject',
        's3:DeleteObject',
      ],
      resources: ['arn:aws:s3:::*'],
    }));

    // EventBridge permissions for publishing events
    role.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'events:PutEvents',
      ],
      resources: [
        `arn:aws:events:${this.region}:${this.account}:event-bus/default`,
        `arn:aws:events:${this.region}:${this.account}:event-bus/*`,
      ],
    }));

    // OpenSearch permissions (DISABLED FOR NOW)
    /*
    role.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'es:ESHttpPost',
        'es:ESHttpPut',
        'es:ESHttpGet',
        'es:ESHttpDelete',
      ],
      resources: [openSearchDomain.domainArn + '/*'],
    }));
    */

    return role;
  }

  private createStepFunctionsRole(): iam.Role {
    const role = new iam.Role(this, 'StepFunctionsRole', {
      assumedBy: new iam.CompositePrincipal(
        new iam.ServicePrincipal('states.amazonaws.com'),
        new iam.ServicePrincipal('events.amazonaws.com')
      ),
    });

    role.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'lambda:InvokeFunction',
      ],
      resources: ['*'],
    }));

    role.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'dynamodb:PutItem',
        'dynamodb:GetItem',
        'dynamodb:UpdateItem',
        'dynamodb:DeleteItem',
      ],
      resources: ['*'],
    }));

    return role;
  }

  private createLambdaFunctions(executionRole: iam.Role, stage: string): { [key: string]: lambda.Function } {
    const functions: { [key: string]: lambda.Function } = {};

    // Core Lambda functions
    const coreFunction = [
      'asclepius-orchestrator',
      'asclepius-summary-processor',
      'asclepius-icd10-verify',
      'asclepius-generate-care-plan',
      'asclepius-transcribe-handler',
      'asclepius-HLhandler',
      'asclepiius-dynamoDBwriter',
      'asclepius-dynamoDB-icd-insertion',
      'asclepius-extract-session-id',
    ];

    // Specialist agent functions
    const agentFunctions = [
      'asclepius-agent-diabetes',
      'asclepius-agent-allergies',
      'asclepius-agent-kidney',
      'asclepius-agent-insurance',
      'asclepius-agent-nutritionist',
      'asclepius-agent-ophthalmologist',
      'asclepius-agent-podiatrist',
      'asclepius-agent-hospital-care-team',
      'asclepius-agent-ada',
      'asclepius-agent-social-determinants',
      'asclepius-agent-physical-therapist',
      'asclepius-agent-pharmacist',
    ];

    const allFunctions = [...coreFunction, ...agentFunctions];

    allFunctions.forEach(functionName => {
      const functionNameWithStage = `${functionName}-${stage}`;
      const logGroupName = `/aws/lambda/${functionNameWithStage}`;

      // Create explicit log group with proper removal policy
      const logGroup = new logs.LogGroup(this, `${functionName.replace(/-/g, '')}LogGroup`, {
        logGroupName: logGroupName,
        retention: stage === 'prod' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
        removalPolicy: cdk.RemovalPolicy.DESTROY, // Always delete log groups on stack deletion
      });

      functions[functionName] = new lambda.Function(this, functionName.replace(/-/g, ''), {
        functionName: functionNameWithStage,
        runtime: lambda.Runtime.PYTHON_3_9,
        handler: 'lambda_function.lambda_handler',
        code: lambda.Code.fromAsset(`../lambda/${functionName}`),
        timeout: cdk.Duration.minutes(5),
        memorySize: 512,
        role: executionRole,
        environment: {
          STAGE: stage,
          VISIT_DATA_TABLE: `asclepius-visit-data-${stage}`,
          PATIENT_TABLE: `asclepius-patient-${stage}`,
          VISIT_TABLE: `asclepius-visit-${stage}`,
          TRANSCRIPT_TABLE: `asclepius-transcript-${stage}`,
          AUDIO_BUCKET: `asclepius-audio-${stage}-${this.account}`,
          // HEALTHLAKE_BUCKET: `asclepius-healthlake-${stage}-${this.account}`, // Commented out - not integrating HealthLake now
          // Add knowledge base ID when OpenSearch is re-enabled
          // KNOWLEDGE_BASE_ID: 'your-knowledge-base-id',
        },
        // Link to the explicit log group to ensure proper lifecycle management
        logGroup: logGroup,
      });
    });

    return functions;
  }

  private createMainWorkflowFromJson(
    lambdaFunctions: { [key: string]: lambda.Function },
    visitDataTable: dynamodb.Table,
    role: iam.Role,
    stage: string
  ): stepfunctions.StateMachine {
    // Load the original Step Functions definition
    const workflowPath = path.join(__dirname, '../step-functions/AsclepiusWorkFlow.json');
    const originalDefinition = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));

    // Replace hardcoded ARNs with CDK-generated ones
    const updatedDefinition = this.replaceArnsInDefinition(originalDefinition, lambdaFunctions, visitDataTable, stage);

    return new stepfunctions.StateMachine(this, 'AsclepiusMainWorkflow', {
      stateMachineName: `AsclepiusWorkFlow-${stage}`,
      definitionBody: stepfunctions.DefinitionBody.fromString(JSON.stringify(updatedDefinition)),
      role,
    });
  }

  private createVisitDbWorkflowFromJson(
    lambdaFunctions: { [key: string]: lambda.Function },
    role: iam.Role,
    stage: string
  ): stepfunctions.StateMachine {
    // Load the original Step Functions definition
    const workflowPath = path.join(__dirname, '../step-functions/asclepiusVisitDBWorkflow.json');
    const originalDefinition = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));

    // Replace hardcoded ARNs with CDK-generated ones
    const updatedDefinition = this.replaceArnsInDefinition(originalDefinition, lambdaFunctions, null, stage);

    return new stepfunctions.StateMachine(this, 'AsclepiusVisitDbWorkflow', {
      stateMachineName: `asclepiusVisitDBWorkflow-${stage}`,
      definitionBody: stepfunctions.DefinitionBody.fromString(JSON.stringify(updatedDefinition)),
      role,
    });
  }

  private replaceArnsInDefinition(
    definition: any,
    lambdaFunctions: { [key: string]: lambda.Function },
    visitDataTable: dynamodb.Table | null,
    stage: string
  ): any {
    // Deep clone the definition to avoid modifying the original
    const updated = JSON.parse(JSON.stringify(definition));

    // Function to recursively replace ARNs
    const replaceArns = (obj: any): any => {
      if (typeof obj === 'string') {
        // Replace Lambda function ARNs
        for (const [functionName, lambdaFunction] of Object.entries(lambdaFunctions)) {
          const originalFunctionName = functionName.replace(`-${stage}`, '');
          if (obj.includes(`function:${originalFunctionName}`)) {
            return obj.replace(
              /arn:aws:lambda:[^:]+:[^:]+:function:[^"]+/,
              lambdaFunction.functionArn
            );
          }
        }

        // Replace DynamoDB table name
        if (visitDataTable && obj.includes('asclepius-visit-data')) {
          return obj.replace('asclepius-visit-data', visitDataTable.tableName);
        }

        return obj;
      } else if (Array.isArray(obj)) {
        return obj.map(replaceArns);
      } else if (obj && typeof obj === 'object') {
        const result: any = {};
        for (const [key, value] of Object.entries(obj)) {
          result[key] = replaceArns(value);
        }
        return result;
      }
      return obj;
    };

    return replaceArns(updated);
  }

  private createEcsCluster(
    vpc: ec2.Vpc,
    stage: string,
    certificateArn: string,
    domainName?: string,
    audioBucket?: s3.Bucket,
    visitDataTable?: dynamodb.Table,
    patientTable?: dynamodb.Table,
    visitTable?: dynamodb.Table,
    transcriptTable?: dynamodb.Table
  ): ecs.Cluster {
    const cluster = new ecs.Cluster(this, 'AsclepiusCluster', {
      clusterName: `asclepius-cluster-${stage}`,
      vpc,
    });

    // Create explicit log group for ECS service with proper removal policy
    const ecsLogGroup = new logs.LogGroup(this, 'EcsServiceLogGroup', {
      logGroupName: `/ecs/asclepius-service-${stage}`,
      retention: stage === 'prod' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Always delete log groups on stack deletion
    });

    // Create a custom task role with the exact managed policies from the working configuration
    const taskRole = new iam.Role(this, 'AsclepiusTaskRole', {
      assumedBy: new iam.CompositePrincipal(
        new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
        new iam.ServicePrincipal('transcribe.streaming.amazonaws.com')
      ),
      description: 'Role for Asclepius ECS tasks',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonTranscribeFullAccess')
      ]
    });

    // Add IAM PassRole permission to allow the task to pass its own role to HealthScribe
    taskRole.addToPrincipalPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['iam:PassRole'],
      resources: [taskRole.roleArn]
    }));

    // Create a separate task execution role with the exact managed policy from the working configuration
    const executionRole = new iam.Role(this, 'AsclepiusTaskExecutionRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      description: 'Execution role for Asclepius ECS tasks',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy')
      ]
    });

    // Create the Fargate service with the custom task role and execution role
    const fargateService = new ecsPatterns.ApplicationLoadBalancedFargateService(this, 'AsclepiusBackend', {
      cluster,
      serviceName: `asclepius-service-${stage}`,
      taskImageOptions: {
        image: ecs.ContainerImage.fromAsset('../server'),
        containerPort: 3000, // Container listens on port 3000
        environment: {
          STAGE: stage,
          AWS_REGION: this.region,
          AUDIO_BUCKET_NAME: audioBucket?.bucketName || '',
          HEALTHSCRIBE_OUTPUT_BUCKET: audioBucket?.bucketName || '',
          VISIT_DATA_TABLE: visitDataTable?.tableName || '',
          PATIENT_TABLE: patientTable?.tableName || '',
          VISIT_TABLE: visitTable?.tableName || '',
          TRANSCRIPT_TABLE: transcriptTable?.tableName || '',
        },
        // Use the explicit log group
        logDriver: ecs.LogDrivers.awsLogs({
          streamPrefix: 'asclepius-service',
          logGroup: ecsLogGroup,
        }),
        taskRole: taskRole, // Use our custom task role
        executionRole: executionRole // Use our custom execution role
      },
      memoryLimitMiB: stage === 'prod' ? 2048 : 1024,
      cpu: stage === 'prod' ? 1024 : 512,
      desiredCount: stage === 'prod' ? 2 : 1,
      publicLoadBalancer: true,
      listenerPort: 80, // HTTP listener for health checks and redirects
    });

    // Add HTTPS listener (REQUIRED for HealthScribe)
    const httpsListener = fargateService.loadBalancer.addListener('HttpsListener', {
      port: 443,
      protocol: elbv2.ApplicationProtocol.HTTPS,
      certificates: [elbv2.ListenerCertificate.fromArn(certificateArn)],
      defaultTargetGroups: [fargateService.targetGroup],
    });

    // Redirect HTTP to HTTPS (security best practice)
    fargateService.listener.addAction('RedirectToHttps', {
      action: elbv2.ListenerAction.redirect({
        protocol: 'HTTPS',
        port: '443',
        permanent: true,
      }),
    });

    // Configure target group for WebSocket support and health checks
    fargateService.targetGroup.configureHealthCheck({
      path: '/health', // Assuming your server has a health check endpoint
      protocol: elbv2.Protocol.HTTP,
      port: '3000',
      healthyThresholdCount: 2,
      unhealthyThresholdCount: 3,
      timeout: cdk.Duration.seconds(10),
      interval: cdk.Duration.seconds(30),
    });

    // Enable WebSocket support on the load balancer
    fargateService.loadBalancer.setAttribute('routing.http2.enabled', 'true');
    fargateService.loadBalancer.setAttribute('idle_timeout.timeout_seconds', '300'); // 5 minutes for WebSocket connections

    // Create DNS record if domain name is provided
    if (domainName && domainName.trim() !== '') {
      // Use CloudFormation custom resource to create DNS record
      // This approach works better than CDK's fromLookup which runs at synthesis time

      const dnsRecordRole = new iam.Role(this, 'DNSRecordRole', {
        assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
        managedPolicies: [
          iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        ],
        inlinePolicies: {
          Route53Access: new iam.PolicyDocument({
            statements: [
              new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: [
                  'route53:ListHostedZones',
                  'route53:GetHostedZone',
                  'route53:ChangeResourceRecordSets',
                  'route53:ListResourceRecordSets'
                ],
                resources: ['*'],
              }),
            ],
          }),
        },
      });

      const dnsRecordFunction = new lambda.Function(this, 'DNSRecordFunction', {
        runtime: lambda.Runtime.PYTHON_3_9,
        handler: 'index.handler',
        role: dnsRecordRole,
        timeout: cdk.Duration.minutes(5),
        code: lambda.Code.fromInline(`
import boto3
import json
import urllib3
import os

def handler(event, context):
    print(f"Event: {json.dumps(event)}")
    
    route53 = boto3.client('route53')
    
    # ALB hosted zone IDs by region
    alb_hosted_zone_ids = {
        'us-east-1': 'Z35SXDOTRQ7X7K',
        'us-east-2': 'Z3AADJGX6KTTL2',
        'us-west-1': 'Z368ELLRRE2KJ0',
        'us-west-2': 'Z1H1FL5HABSF5',
        'af-south-1': 'Z268VQBMOI5EKX',
        'ap-east-1': 'Z3DQVH9N71FHZ0',
        'ap-south-1': 'ZP97RAFLXTNZK',
        'ap-south-2': 'Z0173938T07WNTVAEPZN',
        'ap-northeast-1': 'Z14GRHDCWA56QT',
        'ap-northeast-2': 'ZWKZPGTI48KDX',
        'ap-northeast-3': 'Z5LXEXXYW11ES',
        'ap-southeast-1': 'Z1LMS91P8CMLE5',
        'ap-southeast-2': 'Z1GM3OXH4ZPM65',
        'ap-southeast-3': 'Z08888821HLRG5A9ZRTER',
        'ap-southeast-4': 'Z09517862IB2WZLPXG76F',
        'ap-southeast-5': 'Z06010284QMVVW7WO5J',
        'ap-southeast-6': 'Z023301818UFJ50CIO0MV',
        'ap-southeast-7': 'Z0390008CMBRTHFGWBCB',
        'ap-east-2': 'Z02789141MW7T1WBU19PO',
        'ca-central-1': 'ZQSVJUPU6J1EY',
        'ca-west-1': 'Z06473681N0SF6OS049SD',
        'cn-north-1': 'Z1GDH35T77C1KE',
        'cn-northwest-1': 'ZM7IZAIOVVDZF',
        'eu-central-1': 'Z215JYRZR1TBD5',
        'eu-central-2': 'Z06391101F2ZOEP8P5EB3',
        'eu-west-1': 'Z32O12XQLNTSW2',
        'eu-west-2': 'ZHURV8PSTC4K8',
        'eu-west-3': 'Z3Q77PNBQS71R4',
        'eu-north-1': 'Z23TAZ6LKFMNIO',
        'eu-south-1': 'Z3ULH7SSC9OV64',
        'eu-south-2': 'Z0956581394HF5D5LXGAP',
        'il-central-1': 'Z09170902867EHPV2DABU',
        'me-south-1': 'ZS929ML54UICD',
        'me-central-1': 'Z08230872XQRWHG2XF6I',
        'mx-central-1': 'Z023552324OKD1BB28BH5',
        'sa-east-1': 'Z2P70J7HTTTPLU',
        'us-gov-east-1': 'Z166TLBEWOO7G0',
        'us-gov-west-1': 'Z33AYJ8TM3BH4J'
    }
    
    try:
        domain_name = event['ResourceProperties']['DomainName']
        alb_dns_name = event['ResourceProperties']['ALBDnsName']
        aws_region = event['ResourceProperties']['AWSRegion']
        request_type = event['RequestType']
        
        # Get the ALB hosted zone ID for the current region
        alb_hosted_zone_id = alb_hosted_zone_ids.get(aws_region)
        if not alb_hosted_zone_id:
            raise Exception(f"ALB hosted zone ID not found for region: {aws_region}")
        
        print(f"Using ALB hosted zone ID {alb_hosted_zone_id} for region {aws_region}")
        
        # Find hosted zone
        hosted_zones = route53.list_hosted_zones()['HostedZones']
        hosted_zone_id = None
        
        for zone in hosted_zones:
            zone_name = zone['Name'].rstrip('.')
            if zone_name == domain_name:
                hosted_zone_id = zone['Id']
                print(f"Found hosted zone: {zone_name} -> {hosted_zone_id}")
                break
        
        if not hosted_zone_id:
            print(f"No hosted zone found for {domain_name}")
            send_response(event, context, "SUCCESS", {"Message": "No hosted zone found"})
            return
        
        if request_type in ['Create', 'Update']:
            # Create/Update ALIAS record (not CNAME) for zone apex
            # ALIAS records are allowed at zone apex, CNAME records are not
            response = route53.change_resource_record_sets(
                HostedZoneId=hosted_zone_id,
                ChangeBatch={
                    'Changes': [{
                        'Action': 'UPSERT',
                        'ResourceRecordSet': {
                            'Name': domain_name,
                            'Type': 'A',
                            'AliasTarget': {
                                'DNSName': alb_dns_name,
                                'EvaluateTargetHealth': False,
                                'HostedZoneId': alb_hosted_zone_id
                            }
                        }
                    }]
                }
            )
            print(f"DNS ALIAS record created/updated: {domain_name} -> {alb_dns_name}")
            
        elif request_type == 'Delete':
            # Delete ALIAS record
            try:
                route53.change_resource_record_sets(
                    HostedZoneId=hosted_zone_id,
                    ChangeBatch={
                        'Changes': [{
                            'Action': 'DELETE',
                            'ResourceRecordSet': {
                                'Name': domain_name,
                                'Type': 'A',
                                'AliasTarget': {
                                    'DNSName': alb_dns_name,
                                    'EvaluateTargetHealth': False,
                                    'HostedZoneId': alb_hosted_zone_id
                                }
                            }
                        }]
                    }
                )
                print(f"DNS ALIAS record deleted: {domain_name}")
            except Exception as e:
                print(f"Could not delete DNS record (may not exist): {e}")
        
        send_response(event, context, "SUCCESS", {"Message": f"DNS operation completed for {domain_name}"})
        
    except Exception as e:
        print(f"Error: {e}")
        send_response(event, context, "FAILED", {"Message": str(e)})

def send_response(event, context, status, data):
    response_body = {
        'Status': status,
        'Reason': f'See CloudWatch Log Stream: {context.log_stream_name}',
        'PhysicalResourceId': context.log_stream_name,
        'StackId': event['StackId'],
        'RequestId': event['RequestId'],
        'LogicalResourceId': event['LogicalResourceId'],
        'Data': data
    }
    
    http = urllib3.PoolManager()
    response = http.request('PUT', event['ResponseURL'], 
                          body=json.dumps(response_body),
                          headers={'Content-Type': 'application/json'})
    print(f"Response status: {response.status}")
`),
      });

      // Create custom resource to trigger DNS record creation
      new cdk.CustomResource(this, 'DNSRecord', {
        serviceToken: dnsRecordFunction.functionArn,
        properties: {
          DomainName: domainName,
          ALBDnsName: fargateService.loadBalancer.loadBalancerDnsName,
          AWSRegion: this.region,
        },
      });
    }

    // Determine the endpoint to output
    const albDnsName = fargateService.loadBalancer.loadBalancerDnsName;
    const webSocketEndpoint = domainName && domainName.trim() !== ''
      ? `wss://${domainName}`
      : `wss://${albDnsName}`;

    // Output the WebSocket endpoint for frontend configuration
    new cdk.CfnOutput(this, 'WebSocketEndpoint', {
      value: webSocketEndpoint,
      description: 'WSS endpoint for HealthScribe streaming (use this in your frontend)',
      exportName: `Asclepius-${stage}-WebSocketEndpoint`
    });

    new cdk.CfnOutput(this, 'LoadBalancerDNS', {
      value: albDnsName,
      description: 'ALB DNS name',
      exportName: `Asclepius-${stage}-LoadBalancerDNS`
    });

    new cdk.CfnOutput(this, 'LoadBalancerArn', {
      value: fargateService.loadBalancer.loadBalancerArn,
      description: 'ALB ARN',
      exportName: `Asclepius-${stage}-LoadBalancerArn`
    });

    // Output deployment instructions
    new cdk.CfnOutput(this, 'DeploymentInstructions', {
      value: domainName && domainName.trim() !== ''
        ? `If DNS record wasn't created automatically, manually create: CNAME ${domainName} -> ${albDnsName}`
        : `Use ALB DNS directly: ${albDnsName}`,
      description: 'DNS setup instructions (if manual configuration needed)'
    });

    // Set the HEALTHSCRIBE_ROLE_ARN environment variable to the task role ARN
    const container = fargateService.taskDefinition.defaultContainer;
    if (container) {
      container.addEnvironment('HEALTHSCRIBE_ROLE_ARN', taskRole.roleArn);

      // Add AWS_SDK_LOAD_CONFIG to ensure SDK loads credentials properly
      container.addEnvironment('AWS_SDK_LOAD_CONFIG', '1');
    }

    // Grant additional permissions to DynamoDB tables if needed
    if (visitDataTable) {
      visitDataTable.grantReadWriteData(taskRole);
    }
    if (patientTable) {
      patientTable.grantReadWriteData(taskRole);
    }
    if (visitTable) {
      visitTable.grantReadWriteData(taskRole);
    }
    if (transcriptTable) {
      transcriptTable.grantReadWriteData(taskRole);
    }

    // Output the task role ARN for reference
    new cdk.CfnOutput(this, 'TaskRoleArn', {
      value: taskRole.roleArn,
      description: 'ECS Task Role ARN used for HealthScribe',
      exportName: `Asclepius-${stage}-TaskRoleArn`
    });

    return cluster;
  }
}
