import {
  ModelConfig,
  GenerateRequest,
  Message
} from './types';
import { fetch } from 'bun';

// rewrite abstraction layer shit
export default class Model {
  private config: ModelConfig;

  private openaiBaseUrl = 'https://api.openai.com';
  private anthropicBaseUrl = 'https://api.anthropic.com';
  private ollamaBaseUrl = 'https://localhost:11434';

  public constructor(config: ModelConfig) {
    this.config = config;

    if (config.ollama?.host || config.ollama?.apiKey) this.ollamaBaseUrl = config.ollama.host || 'https://ollama.com';
  }

  private async fetchList(url: string, headers: HeadersInit) {
    const res = await fetch(url, {
      method: "GET",
      headers
    });
    if (!res.ok) {
      throw {
        status: res.statusText,
        statusCode: res.status,
        response: await res.json()
      };
    }
    const data = await res.json();
    return data;
  }

  private async fetchGenerate(url: string, headers: HeadersInit, body: any) {
    // console.log(JSON.stringify(body, null, 2));
    // process.exit(0);
    const res = await fetch(url, {
      method: "POST",
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      throw {
        status: res.statusText,
        statusCode: res.status,
        response: await res.json()
      };
    }
    const data = await res.json();
    return data;
  }
  
  public async list() {
    const config = this.config;
    const modelList: string[] = [];

    if (config.ollama?.host || config.ollama?.apiKey) {
      try {
        const ollamaList = await this.fetchList(`${this.ollamaBaseUrl}/api/tags`, {
          Authorization: 'Bearer ' + config.ollama?.apiKey
        }) as { models: Record<any, string | number>[] };
        for (const m of ollamaList.models) {
          modelList.push('ollama/'+m.model);
        }
      } catch (err) {
        console.error(err);
        console.error('failed to list ollama models');
      }
    }

    if (config.openai?.apiKey) {
      try {
        const openaiList = await this.fetchList(`${this.openaiBaseUrl}/v1/models`, {
          Authorization: 'Bearer ' + config.openai.apiKey
        }) as { data: Record<any, string | number>[] };
        for (const m of openaiList.data) {
          modelList.push('openai/'+m.id);
        }
      } catch (err) {
        console.error(err);
        console.error('failed to list openai models');
      }
    }

    if (config.anthropic?.apiKey) {
      try {
        const anthropicList = await this.fetchList(`${this.anthropicBaseUrl}/v1/models`, {
          "X-Api-Key": config.anthropic.apiKey,
          "anthropic-version": "2023-06-01"
        }) as { data: Record<any, string | number>[] };
        for (const m of anthropicList.data) {
          modelList.push('anthropic/'+m.id);
        }
      } catch (err) {
        console.error(err);
        console.error('failed to list anthropic models');
      }
    }

    return modelList;
  }

  public async generate(request: GenerateRequest) {
    const config = this.config;
    const rawModel = request.model.split('/');
    const provider = rawModel[0];
    const model = rawModel[1];

    if (provider == 'ollama') {
      const headers = {
        Authorization: 'Bearer ' + config.ollama?.apiKey
      };
      try {
        const messages: Message[] = []
        
        if (request.system) {
          messages.push({
            role: 'system',
            content: request.system
          })
        }

        messages.push(...request.messages);
        delete request.system;

        const response = await this.fetchGenerate(`${this.ollamaBaseUrl}/api/chat`, headers, {
          ...request,
          model,
          messages,
          stream: false,
          think: request.think ? 'medium' : 'low',
          format: this.config.scheme ? 'json' : 'text'
        });

        const { message } = response;
        return {
          message: {
            role: message.role,
            content: message.content
          } as Message
        };
      } catch (err) {
        console.error(err);
        throw new Error("failed to generate ollama response");
      }
    }

    if (provider == 'openai')  {
      const headers = {
        Authorization: 'Bearer ' + config.openai?.apiKey
      };
      const body: any = {
        model,
        input: request.messages.map(m => ({
          role: m.role,
          content: [
            {
              type: 'input_text',
              text: m.content
            }
          ]
        })),
        text: {
          format: this.config.scheme ? {
            type: 'json_schema',
            name: 'translated_cues',
            schema: this.config.scheme
          } : {
            type: 'text',
          }
        },
        reasoning: {
          effort: request.think ? 'medium' : 'low'
        },
        stream: false
      }
      try {
        if (request.system) body.instructions = request.system;
        const response = await this.fetchGenerate(`${this.openaiBaseUrl}/v1/responses`, headers, body);
        const content = response.output.filter((c: any) => c.type == 'message')[0];
        return {
          message: {
            role: content.role,
            content: content.content[0].text
          } as Message
        };
      } catch (err) {
        console.error(err);
        throw new Error("failed to generate openai response");
      }
    }

    if (provider == 'anthropic') {
      try {
        const headers = {
          "X-Api-Key": config.anthropic?.apiKey ?? '',
          "anthropic-version": "2023-06-01"
        };
        const body: any = {
          model,
          messages: request.messages,
          output_config: this.config.scheme ? ({
            format:  {
              type: 'json_schema',
              schema: this.config.scheme
            }
          }) : {},
          stream: false,
          max_tokens: 1280,
          thinking: {
            type: 'disabled',
          }
        }
        if (request.system) body.system = request.system
        const response = await this.fetchGenerate(`${this.anthropicBaseUrl}/v1/messages`, headers, body);
        const { content, role } = response;
        return {
          message: {
            role: role,
            content: content.filter((c: any) => c.type == 'text')[0].text
          } as Message
        };
      } catch (err) {
        console.error(err);
        throw new Error("failed to generate anthropic response");
      }
    }

    throw new Error(`Invalid provider ${provider} on ${request.model}`);
  }
}