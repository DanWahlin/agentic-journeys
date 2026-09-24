targetScope = 'subscription'

@minLength(1)
@maxLength(64)
param environmentName string

param location string = 'westus'

@minLength(1)
param modelVersion string

@minLength(36)
@maxLength(36)
param principalId string

@minLength(1)
param principalLogin string

@allowed([
  'User'
  'ServicePrincipal'
])
param principalType string

var resourceToken = take(uniqueString(subscription().id, environmentName, location), 13)
var tags = {
  'azd-env-name': environmentName
}

resource resourceGroup 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: 'rg-${environmentName}'
  location: location
  tags: tags
}

module resources './modules/resources.bicep' = {
  name: 'smart-todo-resources'
  scope: resourceGroup
  params: {
    environmentName: environmentName
    location: location
    modelVersion: modelVersion
    principalId: principalId
    principalLogin: principalLogin
    principalType: principalType
    resourceToken: resourceToken
    tags: tags
  }
}

output API_URL string = resources.outputs.apiUrl
output SQL_SERVER_NAME string = resources.outputs.sqlServerName
output SQL_DATABASE_NAME string = resources.outputs.sqlDatabaseName
output FUNCTION_APP_NAME string = resources.outputs.functionAppName
output AZURE_AI_ENDPOINT string = resources.outputs.aiEndpoint
output AZURE_AI_DEPLOYMENT string = resources.outputs.aiDeploymentName
output RESOURCE_GROUP_NAME string = resourceGroup.name
output SQL_IDENTITY_NAME string = resources.outputs.sqlIdentityName
output SQL_IDENTITY_CLIENT_ID string = resources.outputs.sqlIdentityClientId
