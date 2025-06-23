const pulumi = require("@pulumi/pulumi");
const aws = require("@pulumi/aws");
const awsx = require("@pulumi/awsx");

// Configuration
const config = new pulumi.Config();
const projectName = "krwx-stablecoin";
const environment = config.get("environment") || "dev";

// Import base infrastructure
const baseInfra = require("./index");

// Default tags
const defaultTags = {
    Project: projectName,
    Environment: environment,
    ManagedBy: "Pulumi",
    Component: "Monitoring",
};

// ElasticSearch for Logging (ELK Stack)
const elasticsearchDomain = new aws.elasticsearch.Domain(`${projectName}-elasticsearch`, {
    domainName: `${projectName}-es-${environment}`,
    elasticsearchVersion: "7.10",
    
    clusterConfig: {
        instanceType: environment === "prod" ? "t3.medium.elasticsearch" : "t3.small.elasticsearch",
        instanceCount: environment === "prod" ? 3 : 1,
    },
    
    ebsOptions: {
        ebsEnabled: true,
        volumeType: "gp2",
        volumeSize: environment === "prod" ? 100 : 20,
    },
    
    vpcOptions: {
        subnetIds: baseInfra.privateSubnetIds,
        securityGroupIds: [esSecurityGroup.id],
    },
    
    encryptAtRest: {
        enabled: true,
    },
    
    nodeToNodeEncryption: {
        enabled: true,
    },
    
    domainEndpointOptions: {
        enforceHttps: true,
        tlsSecurityPolicy: "Policy-Min-TLS-1-2-2019-07",
    },
    
    snapshotOptions: {
        automatedSnapshotStartHour: 3,
    },
    
    tags: {
        ...defaultTags,
        Name: `${projectName}-elasticsearch-${environment}`,
    },
});

// Security Group for ElasticSearch
const esSecurityGroup = new aws.ec2.SecurityGroup(`${projectName}-es-sg`, {
    vpcId: baseInfra.vpcId,
    description: "Security group for ElasticSearch domain",
    ingress: [
        {
            protocol: "tcp",
            fromPort: 443,
            toPort: 443,
            securityGroups: [monitoringSecurityGroup.id],
            description: "HTTPS access from monitoring services",
        },
    ],
    tags: {
        ...defaultTags,
        Name: `${projectName}-es-sg-${environment}`,
    },
});

// Security Group for Monitoring Services
const monitoringSecurityGroup = new aws.ec2.SecurityGroup(`${projectName}-monitoring-sg`, {
    vpcId: baseInfra.vpcId,
    description: "Security group for monitoring services",
    ingress: [
        {
            protocol: "tcp",
            fromPort: 3000,
            toPort: 3000,
            cidrBlocks: ["10.0.0.0/16"],
            description: "Grafana access within VPC",
        },
        {
            protocol: "tcp",
            fromPort: 9090,
            toPort: 9090,
            cidrBlocks: ["10.0.0.0/16"],
            description: "Prometheus access within VPC",
        },
        {
            protocol: "tcp",
            fromPort: 5601,
            toPort: 5601,
            cidrBlocks: ["10.0.0.0/16"],
            description: "Kibana access within VPC",
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
        Name: `${projectName}-monitoring-sg-${environment}`,
    },
});

// CloudWatch Dashboard
const dashboard = new aws.cloudwatch.Dashboard(`${projectName}-dashboard`, {
    dashboardName: `${projectName}-${environment}`,
    dashboardBody: JSON.stringify({
        widgets: [
            {
                type: "metric",
                x: 0,
                y: 0,
                width: 12,
                height: 6,
                properties: {
                    metrics: [
                        ["AWS/ECS", "CPUUtilization", "ServiceName", `${projectName}-backend-${environment}`],
                        [".", "MemoryUtilization", ".", "."],
                    ],
                    period: 300,
                    stat: "Average",
                    region: "us-east-1",
                    title: "ECS Service Metrics",
                },
            },
            {
                type: "metric",
                x: 0,
                y: 6,
                width: 12,
                height: 6,
                properties: {
                    metrics: [
                        ["AWS/RDS", "CPUUtilization", "DBInstanceIdentifier", `${projectName}-db-${environment}`],
                        [".", "DatabaseConnections", ".", "."],
                        [".", "ReadLatency", ".", "."],
                        [".", "WriteLatency", ".", "."],
                    ],
                    period: 300,
                    stat: "Average",
                    region: "us-east-1",
                    title: "RDS Metrics",
                },
            },
            {
                type: "metric",
                x: 0,
                y: 12,
                width: 12,
                height: 6,
                properties: {
                    metrics: [
                        ["AWS/ElastiCache", "CPUUtilization", "CacheClusterId", `${projectName}-redis-${environment}`],
                        [".", "NetworkBytesIn", ".", "."],
                        [".", "NetworkBytesOut", ".", "."],
                    ],
                    period: 300,
                    stat: "Average",
                    region: "us-east-1",
                    title: "ElastiCache Metrics",
                },
            },
            {
                type: "log",
                x: 0,
                y: 18,
                width: 24,
                height: 6,
                properties: {
                    query: `SOURCE '/ecs/${projectName}-backend-${environment}'\n| fields @timestamp, @message\n| sort @timestamp desc\n| limit 100`,
                    region: "us-east-1",
                    title: "Recent Backend Logs",
                    view: "table",
                },
            },
        ],
    }),
});

// CloudWatch Alarms
const cpuAlarm = new aws.cloudwatch.MetricAlarm(`${projectName}-cpu-alarm`, {
    name: `${projectName}-${environment}-high-cpu`,
    comparisonOperator: "GreaterThanThreshold",
    evaluationPeriods: 2,
    metricName: "CPUUtilization",
    namespace: "AWS/ECS",
    period: 300,
    statistic: "Average",
    threshold: 80,
    alarmDescription: "This metric monitors ECS CPU utilization",
    dimensions: {
        ServiceName: `${projectName}-backend-${environment}`,
    },
    alarmActions: [snsTopicArn],
    tags: {
        ...defaultTags,
        Name: `${projectName}-cpu-alarm-${environment}`,
    },
});

const memoryAlarm = new aws.cloudwatch.MetricAlarm(`${projectName}-memory-alarm`, {
    name: `${projectName}-${environment}-high-memory`,
    comparisonOperator: "GreaterThanThreshold",
    evaluationPeriods: 2,
    metricName: "MemoryUtilization",
    namespace: "AWS/ECS",
    period: 300,
    statistic: "Average",
    threshold: 85,
    alarmDescription: "This metric monitors ECS memory utilization",
    dimensions: {
        ServiceName: `${projectName}-backend-${environment}`,
    },
    alarmActions: [snsTopicArn],
    tags: {
        ...defaultTags,
        Name: `${projectName}-memory-alarm-${environment}`,
    },
});

const dbConnectionsAlarm = new aws.cloudwatch.MetricAlarm(`${projectName}-db-connections-alarm`, {
    name: `${projectName}-${environment}-high-db-connections`,
    comparisonOperator: "GreaterThanThreshold",
    evaluationPeriods: 2,
    metricName: "DatabaseConnections",
    namespace: "AWS/RDS",
    period: 300,
    statistic: "Average",
    threshold: 80,
    alarmDescription: "This metric monitors RDS database connections",
    dimensions: {
        DBInstanceIdentifier: `${projectName}-db-${environment}`,
    },
    alarmActions: [snsTopicArn],
    tags: {
        ...defaultTags,
        Name: `${projectName}-db-connections-alarm-${environment}`,
    },
});

// SNS Topic for Alerts
const snsTopic = new aws.sns.Topic(`${projectName}-alerts`, {
    name: `${projectName}-alerts-${environment}`,
    displayName: `${projectName} Alerts (${environment})`,
    tags: {
        ...defaultTags,
        Name: `${projectName}-alerts-${environment}`,
    },
});

const snsTopicArn = snsTopic.arn;

// SNS Topic Subscription (이메일)
const snsSubscription = new aws.sns.TopicSubscription(`${projectName}-email-alerts`, {
    topicArn: snsTopic.arn,
    protocol: "email",
    endpoint: config.get("alert-email") || "admin@example.com",
});

// CloudWatch Log Insights Queries
const logInsightsQueries = [
    {
        name: "Error Logs",
        queryString: `fields @timestamp, @message, @logStream
| filter @message like /ERROR/
| sort @timestamp desc
| limit 100`,
    },
    {
        name: "API Response Times",
        queryString: `fields @timestamp, @message
| filter @message like /API request/
| parse @message /responseTime: (?<responseTime>\\d+)/
| stats avg(responseTime), max(responseTime), min(responseTime) by bin(5m)`,
    },
    {
        name: "Payment Events",
        queryString: `fields @timestamp, @message
| filter @message like /payment_event/
| parse @message /paymentId: "(?<paymentId>[^"]+)"/
| parse @message /event: "(?<event>[^"]+)"/
| stats count() by event, bin(1h)`,
    },
];

// WAF for Application Protection
const webAcl = new aws.wafv2.WebAcl(`${projectName}-waf`, {
    name: `${projectName}-waf-${environment}`,
    description: "WAF for stablecoin application",
    scope: "REGIONAL",
    
    defaultAction: {
        allow: {},
    },
    
    rules: [
        {
            name: "RateLimitRule",
            priority: 1,
            action: {
                block: {},
            },
            statement: {
                rateBasedStatement: {
                    limit: 2000,
                    aggregateKeyType: "IP",
                },
            },
            visibilityConfig: {
                sampledRequestsEnabled: true,
                cloudwatchMetricsEnabled: true,
                metricName: "RateLimitRule",
            },
        },
        {
            name: "AWSManagedRulesCommonRuleSet",
            priority: 2,
            overrideAction: {
                none: {},
            },
            statement: {
                managedRuleGroupStatement: {
                    vendorName: "AWS",
                    name: "AWSManagedRulesCommonRuleSet",
                },
            },
            visibilityConfig: {
                sampledRequestsEnabled: true,
                cloudwatchMetricsEnabled: true,
                metricName: "CommonRuleSetMetric",
            },
        },
        {
            name: "AWSManagedRulesKnownBadInputsRuleSet",
            priority: 3,
            overrideAction: {
                none: {},
            },
            statement: {
                managedRuleGroupStatement: {
                    vendorName: "AWS",
                    name: "AWSManagedRulesKnownBadInputsRuleSet",
                },
            },
            visibilityConfig: {
                sampledRequestsEnabled: true,
                cloudwatchMetricsEnabled: true,
                metricName: "KnownBadInputsRuleSetMetric",
            },
        },
    ],
    
    visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudwatchMetricsEnabled: true,
        metricName: `${projectName}WAFMetric${environment}`,
    },
    
    tags: {
        ...defaultTags,
        Name: `${projectName}-waf-${environment}`,
    },
});

// Export monitoring resources
module.exports = {
    elasticsearchDomain,
    dashboard,
    snsTopic,
    webAcl,
    monitoringSecurityGroup,
    logInsightsQueries,
}; 