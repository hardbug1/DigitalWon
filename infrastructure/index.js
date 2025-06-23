const pulumi = require("@pulumi/pulumi");
const aws = require("@pulumi/aws");
const awsx = require("@pulumi/awsx");

// Configuration
const config = new pulumi.Config();
const projectName = "krwx-stablecoin";
const environment = config.get("environment") || "dev";

// Tags for all resources
const defaultTags = {
    Project: projectName,
    Environment: environment,
    ManagedBy: "Pulumi",
};

// VPC and Network Configuration
const vpc = new awsx.ec2.Vpc(`${projectName}-vpc`, {
    cidrBlock: "10.0.0.0/16",
    numberOfAvailabilityZones: 2,
    enableDnsHostnames: true,
    enableDnsSupport: true,
    tags: {
        ...defaultTags,
        Name: `${projectName}-vpc-${environment}`,
    },
});

// Security Groups
const albSecurityGroup = new aws.ec2.SecurityGroup(`${projectName}-alb-sg`, {
    vpcId: vpc.vpcId,
    description: "Security group for Application Load Balancer",
    ingress: [
        {
            protocol: "tcp",
            fromPort: 80,
            toPort: 80,
            cidrBlocks: ["0.0.0.0/0"],
            description: "HTTP access from anywhere",
        },
        {
            protocol: "tcp",
            fromPort: 443,
            toPort: 443,
            cidrBlocks: ["0.0.0.0/0"],
            description: "HTTPS access from anywhere",
        },
    ],
    egress: [
        {
            protocol: "-1",
            fromPort: 0,
            toPort: 0,
            cidrBlocks: ["0.0.0.0/0"],
            description: "All outbound traffic",
        },
    ],
    tags: {
        ...defaultTags,
        Name: `${projectName}-alb-sg-${environment}`,
    },
});

const appSecurityGroup = new aws.ec2.SecurityGroup(`${projectName}-app-sg`, {
    vpcId: vpc.vpcId,
    description: "Security group for application containers",
    ingress: [
        {
            protocol: "tcp",
            fromPort: 3000,
            toPort: 3000,
            securityGroups: [albSecurityGroup.id],
            description: "Access from ALB only",
        },
        {
            protocol: "tcp",
            fromPort: 3001,
            toPort: 3001,
            securityGroups: [albSecurityGroup.id],
            description: "Frontend access from ALB only",
        },
    ],
    egress: [
        {
            protocol: "-1",
            fromPort: 0,
            toPort: 0,
            cidrBlocks: ["0.0.0.0/0"],
            description: "All outbound traffic",
        },
    ],
    tags: {
        ...defaultTags,
        Name: `${projectName}-app-sg-${environment}`,
    },
});

const dbSecurityGroup = new aws.ec2.SecurityGroup(`${projectName}-db-sg`, {
    vpcId: vpc.vpcId,
    description: "Security group for RDS PostgreSQL",
    ingress: [
        {
            protocol: "tcp",
            fromPort: 5432,
            toPort: 5432,
            securityGroups: [appSecurityGroup.id],
            description: "PostgreSQL access from app containers",
        },
    ],
    tags: {
        ...defaultTags,
        Name: `${projectName}-db-sg-${environment}`,
    },
});

const redisSecurityGroup = new aws.ec2.SecurityGroup(`${projectName}-redis-sg`, {
    vpcId: vpc.vpcId,
    description: "Security group for ElastiCache Redis",
    ingress: [
        {
            protocol: "tcp",
            fromPort: 6379,
            toPort: 6379,
            securityGroups: [appSecurityGroup.id],
            description: "Redis access from app containers",
        },
    ],
    tags: {
        ...defaultTags,
        Name: `${projectName}-redis-sg-${environment}`,
    },
});

// RDS PostgreSQL
const dbSubnetGroup = new aws.rds.SubnetGroup(`${projectName}-db-subnet-group`, {
    subnetIds: vpc.privateSubnetIds,
    description: "Subnet group for RDS PostgreSQL database",
    tags: {
        ...defaultTags,
        Name: `${projectName}-db-subnet-group-${environment}`,
    },
});

const dbParameterGroup = new aws.rds.ParameterGroup(`${projectName}-db-params`, {
    family: "postgres15",
    description: "Custom parameter group for PostgreSQL 15",
    parameters: [
        {
            name: "shared_preload_libraries",
            value: "pg_stat_statements",
        },
        {
            name: "log_statement",
            value: "all",
        },
        {
            name: "log_min_duration_statement",
            value: "1000",
        },
    ],
    tags: {
        ...defaultTags,
        Name: `${projectName}-db-params-${environment}`,
    },
});

const database = new aws.rds.Instance(`${projectName}-db`, {
    engine: "postgres",
    engineVersion: "15.4",
    instanceClass: environment === "prod" ? "db.t3.medium" : "db.t3.micro",
    allocatedStorage: environment === "prod" ? 100 : 20,
    maxAllocatedStorage: environment === "prod" ? 1000 : 100,
    storageType: "gp2",
    storageEncrypted: true,
    
    dbName: "stablecoin",
    username: "postgres",
    password: config.requireSecret("db-password"),
    
    vpcSecurityGroupIds: [dbSecurityGroup.id],
    dbSubnetGroupName: dbSubnetGroup.name,
    parameterGroupName: dbParameterGroup.name,
    
    backupRetentionPeriod: environment === "prod" ? 30 : 7,
    backupWindow: "03:00-04:00",
    maintenanceWindow: "sun:04:00-sun:05:00",
    
    skipFinalSnapshot: environment !== "prod",
    deletionProtection: environment === "prod",
    
    monitoringInterval: environment === "prod" ? 60 : 0,
    performanceInsightsEnabled: environment === "prod",
    
    tags: {
        ...defaultTags,
        Name: `${projectName}-db-${environment}`,
    },
});

// ElastiCache Redis
const redisSubnetGroup = new aws.elasticache.SubnetGroup(`${projectName}-redis-subnet-group`, {
    subnetIds: vpc.privateSubnetIds,
    description: "Subnet group for ElastiCache Redis",
});

const redisCluster = new aws.elasticache.ReplicationGroup(`${projectName}-redis`, {
    description: "Redis cluster for caching and sessions",
    nodeType: environment === "prod" ? "cache.t3.medium" : "cache.t3.micro",
    port: 6379,
    parameterGroupName: "default.redis7",
    
    numCacheNodes: 1,
    
    subnetGroupName: redisSubnetGroup.name,
    securityGroupIds: [redisSecurityGroup.id],
    
    atRestEncryptionEnabled: true,
    transitEncryptionEnabled: true,
    
    snapshotRetentionLimit: environment === "prod" ? 7 : 1,
    snapshotWindow: "03:00-05:00",
    maintenanceWindow: "sun:05:00-sun:06:00",
    
    tags: {
        ...defaultTags,
        Name: `${projectName}-redis-${environment}`,
    },
});

// S3 Bucket for Static Assets
const assetsBucket = new aws.s3.Bucket(`${projectName}-assets`, {
    bucket: `${projectName}-assets-${environment}-${Date.now()}`,
    tags: {
        ...defaultTags,
        Name: `${projectName}-assets-${environment}`,
    },
});

const bucketPublicAccessBlock = new aws.s3.BucketPublicAccessBlock(`${projectName}-assets-pab`, {
    bucket: assetsBucket.id,
    blockPublicAcls: true,
    blockPublicPolicy: true,
    ignorePublicAcls: true,
    restrictPublicBuckets: true,
});

// CloudFront Distribution
const cloudfrontDistribution = new aws.cloudfront.Distribution(`${projectName}-cdn`, {
    origins: [
        {
            domainName: assetsBucket.bucketDomainName,
            originId: "S3-Assets",
            s3OriginConfig: {
                originAccessIdentity: new aws.cloudfront.OriginAccessIdentity(`${projectName}-oai`, {
                    comment: "Origin Access Identity for assets bucket",
                }).cloudfrontAccessIdentityPath,
            },
        },
    ],
    
    enabled: true,
    comment: "CDN for static assets",
    defaultRootObject: "index.html",
    
    defaultCacheBehavior: {
        targetOriginId: "S3-Assets",
        viewerProtocolPolicy: "redirect-to-https",
        allowedMethods: ["GET", "HEAD"],
        cachedMethods: ["GET", "HEAD"],
        compress: true,
        
        forwardedValues: {
            queryString: false,
            cookies: {
                forward: "none",
            },
        },
        
        minTtl: 0,
        defaultTtl: 86400,
        maxTtl: 31536000,
    },
    
    restrictions: {
        geoRestriction: {
            restrictionType: "none",
        },
    },
    
    viewerCertificate: {
        cloudfrontDefaultCertificate: true,
    },
    
    tags: {
        ...defaultTags,
        Name: `${projectName}-cdn-${environment}`,
    },
});

// ECS Cluster
const cluster = new aws.ecs.Cluster(`${projectName}-cluster`, {
    name: `${projectName}-cluster-${environment}`,
    settings: [
        {
            name: "containerInsights",
            value: "enabled",
        },
    ],
    tags: {
        ...defaultTags,
        Name: `${projectName}-cluster-${environment}`,
    },
});

// Application Load Balancer
const alb = new awsx.elasticloadbalancingv2.ApplicationLoadBalancer(`${projectName}-alb`, {
    name: `${projectName}-alb-${environment}`,
    listener: {
        port: 80,
        protocol: "HTTP",
    },
    subnetIds: vpc.publicSubnetIds,
    securityGroups: [albSecurityGroup.id],
    tags: {
        ...defaultTags,
        Name: `${projectName}-alb-${environment}`,
    },
});

// IAM Role for ECS Tasks
const taskRole = new aws.iam.Role(`${projectName}-task-role`, {
    assumeRolePolicy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
            {
                Action: "sts:AssumeRole",
                Effect: "Allow",
                Principal: {
                    Service: "ecs-tasks.amazonaws.com",
                },
            },
        ],
    }),
    tags: {
        ...defaultTags,
        Name: `${projectName}-task-role-${environment}`,
    },
});

const taskExecutionRole = new aws.iam.Role(`${projectName}-task-execution-role`, {
    assumeRolePolicy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
            {
                Action: "sts:AssumeRole",
                Effect: "Allow",
                Principal: {
                    Service: "ecs-tasks.amazonaws.com",
                },
            },
        ],
    }),
    managedPolicyArns: [
        "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy",
    ],
    tags: {
        ...defaultTags,
        Name: `${projectName}-task-execution-role-${environment}`,
    },
});

// CloudWatch Log Groups
const backendLogGroup = new aws.cloudwatch.LogGroup(`${projectName}-backend-logs`, {
    name: `/ecs/${projectName}-backend-${environment}`,
    retentionInDays: environment === "prod" ? 30 : 7,
    tags: {
        ...defaultTags,
        Name: `${projectName}-backend-logs-${environment}`,
    },
});

const frontendLogGroup = new aws.cloudwatch.LogGroup(`${projectName}-frontend-logs`, {
    name: `/ecs/${projectName}-frontend-${environment}`,
    retentionInDays: environment === "prod" ? 30 : 7,
    tags: {
        ...defaultTags,
        Name: `${projectName}-frontend-logs-${environment}`,
    },
});

// Outputs
exports.vpcId = vpc.vpcId;
exports.publicSubnetIds = vpc.publicSubnetIds;
exports.privateSubnetIds = vpc.privateSubnetIds;
exports.albDnsName = alb.loadBalancer.dnsName;
exports.albZoneId = alb.loadBalancer.zoneId;
exports.dbEndpoint = database.endpoint;
exports.dbPort = database.port;
exports.redisEndpoint = redisCluster.primaryEndpoint;
exports.redisPort = redisCluster.port;
exports.cloudfrontDomainName = cloudfrontDistribution.domainName;
exports.assetsBucketName = assetsBucket.bucket;
exports.ecsClusterName = cluster.name;
exports.taskRoleArn = taskRole.arn;
exports.taskExecutionRoleArn = taskExecutionRole.arn;
exports.backendLogGroupName = backendLogGroup.name;
exports.frontendLogGroupName = frontendLogGroup.name; 