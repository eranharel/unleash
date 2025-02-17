import { Response } from 'express';
import Controller from '../controller';
import { IUnleashConfig, IUnleashServices } from '../../types';
import ClientInstanceService from '../../services/client-metrics/instance-service';
import { Logger } from '../../logger';
import { IAuthRequest } from '../unleash-types';
import ClientMetricsServiceV2 from '../../services/client-metrics/metrics-service-v2';
import { NONE } from '../../types/permissions';
import { OpenApiService } from '../../services/openapi-service';
import { createRequestSchema } from '../../openapi/util/create-request-schema';
import {
    emptyResponse,
    getStandardResponses,
} from '../../openapi/util/standard-responses';

export default class ClientMetricsController extends Controller {
    logger: Logger;

    clientInstanceService: ClientInstanceService;

    openApiService: OpenApiService;

    metricsV2: ClientMetricsServiceV2;

    constructor(
        {
            clientInstanceService,
            clientMetricsServiceV2,
            openApiService,
        }: Pick<
            IUnleashServices,
            | 'clientInstanceService'
            | 'clientMetricsServiceV2'
            | 'openApiService'
        >,
        config: IUnleashConfig,
    ) {
        super(config);
        const { getLogger } = config;

        this.logger = getLogger('/api/client/metrics');
        this.clientInstanceService = clientInstanceService;
        this.openApiService = openApiService;
        this.metricsV2 = clientMetricsServiceV2;

        this.route({
            method: 'post',
            path: '',
            handler: this.registerMetrics,
            permission: NONE,
            middleware: [
                openApiService.validPath({
                    tags: ['Client'],
                    summary: 'Register client usage metrics',
                    description: `Registers usage metrics. Stores information about how many times each toggle was evaluated to enabled and disabled within a time frame. If provided, this operation will also store data on how many times each feature toggle's variants were displayed to the end user.`,
                    operationId: 'registerClientMetrics',
                    requestBody: createRequestSchema('clientMetricsSchema'),
                    responses: {
                        ...getStandardResponses(400),
                        202: emptyResponse,
                        204: emptyResponse,
                    },
                }),
            ],
        });
    }

    async registerMetrics(req: IAuthRequest, res: Response): Promise<void> {
        if (this.config.flagResolver.isEnabled('disableMetrics')) {
            res.status(204).end();
        } else {
            try {
                const { body: data, ip: clientIp, user } = req;
                data.environment = this.metricsV2.resolveMetricsEnvironment(
                    user,
                    data,
                );
                await this.clientInstanceService.registerInstance(
                    data,
                    clientIp,
                );

                await this.metricsV2.registerClientMetrics(data, clientIp);
                res.status(202).end();
            } catch (e) {
                res.status(400).end();
            }
        }
    }
}
