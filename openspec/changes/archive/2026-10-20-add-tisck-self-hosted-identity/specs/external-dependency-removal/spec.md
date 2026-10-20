# Spec Delta

## MODIFIED Requirements

### Requirement: AWS SDK call isolation
Calls to AWS runtime services SHALL NOT be executed when `CLOUDTAK_Mode=docker-compose`.

#### Scenario: SecretsManager bypass
- **WHEN** the application starts up in docker-compose mode and reads JWT signing secrets
- **THEN** it SHALL use the environment variable `SigningSecret` directly without initializing or calling the AWS SecretsManager client

#### Scenario: STS ARN prefix resolution bypass
- **WHEN** the application initializes ETL event routing or queue configuration in docker-compose mode
- **THEN** it SHALL NOT invoke `fetchArnPrefix()` or AWS STS `GetCallerIdentityCommand`

#### Scenario: Authentik API token resolution bypass
- **WHEN** the application initializes AuthentikProvider in docker-compose mode with `AUTHENTIK_API_TOKEN` set
- **THEN** it SHALL use the direct token value without initializing or invoking the AWS SecretsManager client
