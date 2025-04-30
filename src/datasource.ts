import defaults from 'lodash/defaults';
import _ from 'lodash';
import {
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  MutableDataFrame,
  FieldType,
  FieldColorModeId
} from '@grafana/data';

import { getBackendSrv, getTemplateSrv } from '@grafana/runtime';


import { MyQuery, MyDataSourceOptions, defaultQuery } from './types';

// proxy route
const routePath = '/nodegraphds';

export class DataSource extends DataSourceApi<MyQuery, MyDataSourceOptions> {
  url: string;
  constructor(instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>) {
    super(instanceSettings);

    // proxy url
    this.url = instanceSettings.url || '';
  }

  async query(options: DataQueryRequest<MyQuery>): Promise<DataQueryResponse> {
    const promises = options.targets.map(async target => {
      const query = defaults(target, defaultQuery);
      // const dataQuery = getTemplateSrv().replace(query.queryText, options.scopedVars);
      const dataQuery = getTemplateSrv().replace(query.queryText, options.scopedVars as any);


      // fetch graph fields from api
      const responseGraphFields = await this.doRequest('/api/graph/fields', `${dataQuery}`);
      // fetch graph data from api
      const responseGraphData = await this.doRequest('/api/graph/data', `${dataQuery}`);
      // extract fields of the nodes and edges in the graph fields object
      const nodeFieldsResponse = responseGraphFields.data.nodes_fields;
      const edgeFieldsResponse = responseGraphFields.data.edges_fields;
      // Define an interface for types of the FrameField
      interface FrameFieldType {
        name: string;
        type: any;
        config: Record<string, any>;
      }
      // This function gets the fields of the api and transforms them to what grafana dataframe prefers
      function fieldAssignator(FieldsResponse: any): FrameFieldType[] {
        let outputFields: FrameFieldType[] = [];
        FieldsResponse.forEach((field: any) => {
          // fieldType can be either number of string
          let fieldType = field['type'] === 'number' ? FieldType.number : FieldType.string;
          // add 'name' and 'type' items to the output object
          let outputField: FrameFieldType = { name: field['field_name'], type: fieldType, config: {} };
          // add color for 'arc__*' items(only apperas for the nodes)
          if ('color' in field) {
            outputField.config.color = { fixedColor: field['color'], mode: FieldColorModeId.Fixed };
          }
          // add disPlayName for 'detail__*' items
          if ('displayName' in field) {
            outputField.config.displayName = field['displayName'];
          }

          if ('links' in field) {
            outputField.config.links = field['links'];
          }

          
          outputFields.push(outputField);
        });
        return outputFields;
      }
      // Define Frames Meta Data
      const frameMetaData: any = { preferredVisualisationType: 'nodeGraph' };
      // Extract node fields
      const nodeFields: FrameFieldType[] = fieldAssignator(nodeFieldsResponse);
      // Create nodes dataframe
      const nodeFrame = new MutableDataFrame({
        name: 'Nodes',
        refId: query.refId,
        fields: nodeFields,
        meta: frameMetaData,
      });
      // Extract edge fields
      const edgeFields: FrameFieldType[] = fieldAssignator(edgeFieldsResponse);
      // Create Edges dataframe
      const edgeFrame = new MutableDataFrame({
        name: 'Edges',
        refId: query.refId,
        fields: edgeFields,
        meta: frameMetaData,
      });
      // Extract graph data of the related api response
      const nodes = responseGraphData.data.nodes;
      const edges = responseGraphData.data.edges;
      // add nodes to the node dataframe
      nodes.forEach((node: any) => {
        nodeFrame.add(node);
      });
      // add edges to the edges dataframe
      edges.forEach((edge: any) => {
        edgeFrame.add(edge);
      });
      return [nodeFrame, edgeFrame];
    });

    return Promise.all(promises).then(data => ({ data: data[0] }));
  }
  async doRequest(endpoint: string, params?: string) {
    // Do the request on proxy; the server will replace url + routePath with the url
    // defined in plugin.json
    const result = getBackendSrv().datasourceRequest({
      method: 'GET',
      url: `${this.url}${routePath}${endpoint}${params?.length ? `?${params}` : ''}`,
    });
    return result;
  }

  /**
   * Checks whether we can connect to the API.
   */
  async testDatasource() {
    const defaultErrorMessage = 'Cannot connect to API';
    
    try {
      const response = await this.doRequest('/api/health');
      
      if (response.status === 200) {
        return {
          status: 'success',
          message: 'Success',
        };
      } else {
        return {
          status: 'error',
          message: response.statusText ? response.statusText : defaultErrorMessage,
        };
      }
    } catch (err: unknown) {
      let message = defaultErrorMessage; // Set a default error message
      
      // Check if the error is an object and contains statusText or data
      if (err && typeof err === 'object') {
        // If `err` has `statusText` (e.g., from HTTP errors)
        if ('statusText' in err && (err as { statusText?: string }).statusText) {
          message = (err as { statusText: string }).statusText;
        }
        
        // If `err` has `data` and error structure with `code` and `message`
        if ('data' in err && (err as { data?: any }).data) {
          const errorData = (err as { data: any }).data;
          
          if (errorData.error && errorData.error.code && errorData.error.message) {
            message += `: ${errorData.error.code}. ${errorData.error.message}`;
          }
        }
      } else if (_.isString(err)) {
        // If the error is a string (e.g., error message)
        message = err;
      }
  
      return {
        status: 'error',
        message,
      };
    }
  }
 
}
