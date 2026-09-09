import { fetch } from 'bun';

import {
  ModelConfig,
  GenerateRequest,
  Message
} from './types';

type FetchErrorProps = {
  code: string,
  url: string,
  response?: Response,
  json?: unknown
}

type OpenAIFormat = {
  type: 'text'
} | {
  type: 'json_object'
} | {
  type: 'json_schema',
  name: string,
  schema: any
}

type OpenAIConfig = {
  model: string,
  messages: Message[],
  apiKey?: string,
  baseUrl?: string,
  endpoint?: string,
  instruction?: string,
  temperature?: number,
  reasoning?: string | null,
  format?: OpenAIFormat,
}

type OpenAIProviderOptions = {
  baseUrl?: string,
  apiKey?: string,
  useResponsesApi?: boolean,
}

class FetchError extends Error {
  public url: string;
  public code: string;
  public response?: Response;
  public json?: any;
  
  constructor(message: string, options: FetchErrorProps) {
    super(message)
    this.code = options.code;
    this.url = options.url;
    if (options.response) this.response = options.response;
    if (options.json) this.json = options.json;
  }
}

export default class Model {
  private config: ModelConfig;

  protected openaiBaseUrl = 'https://api.openai.com';
  protected anthropicBaseUrl = 'https://api.anthropic.com';
  protected ollamaBaseUrl = 'https://localhost:11434';
  protected lmsBaseUrl = 'http://localhost:1234';
  protected googleBaseUrl = 'https://generativelanguage.googleapis.com';
  protected groqBaseUrl = 'https://api.groq.com/openai';
  protected xaiBaseUrl = 'https://api.x.ai';

  public constructor(config: ModelConfig) {
    this.config = config;

    if (config.ollama?.host || config.ollama?.apiKey) this.ollamaBaseUrl = config.ollama.host || 'https://ollama.com';
    if (config.lmstudio?.host) this.lmsBaseUrl = config.lmstudio.host;
  }

  protected async fetchList(url: string, headers: HeadersInit) {
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

  protected async fetchGenerate(url: string, headers: HeadersInit, body: any) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        throw new FetchError(`failed to fetch ${url}: ${res.status} ${res.statusText}`, {
          url,
          code: 'FailedFetch',
          response: res,
          json: await res.json()
        })
      }
      const data = await res.json();
      return data;
    } catch (err) {
      // @ts-ignore
      if (err instanceof Error && err.code && err.code === 'ConnectionRefused') {
        throw new FetchError(`Unable to connect ${url}. Is the computer able to access the url?`, {
          url,
          code: 'ConnectionRefused'
        });
      }
      throw err;
    }
  }

  protected isGenerativeModel(name: string): boolean {
    const words = ['image', 'embedding', 'tts', 'moderation', 'transcribe', 'audio'];

    for (const exc of words) {
      if (name.includes(exc))
        return false;
    }

    return true;
  }

  protected getOpenAIFormat(): OpenAIFormat {
    if (!this.config.scheme) {
      return {
        type: 'text'
      };
    }

    return {
      type: 'json_schema',
      name: 'translated_cues',
      schema: this.config.scheme
    };
  }

  protected getTemperature(request: GenerateRequest): number | undefined {
    return request.options?.temperature;
  }

  protected parseRequestModel(modelValue: string): { provider?: string, model: string } {
    const rawModel = modelValue.split('/');
    return {
      provider: rawModel[0],
      model: rawModel.length > 2 ? rawModel.slice(1).join('/') : (rawModel[1] ?? 'unknown')
    };
  }

  protected withInstruction(messages: Message[], instruction?: string): Message[] {
    if (!instruction) return messages;
    return [{ role: 'system', content: instruction }, ...messages];
  }

  protected async generateOpenAICompatible(
    request: GenerateRequest,
    model: string,
    options: OpenAIProviderOptions = {}
  ): Promise<{ message: Message }> {
    const config: OpenAIConfig = {
      messages: request.messages,
      model,
      baseUrl: options.baseUrl,
      apiKey: options.apiKey,
      instruction: request.system,
      format: this.getOpenAIFormat(),
      reasoning: request.think ? 'medium' : null,
      temperature: this.getTemperature(request)
    };

    const message = options.useResponsesApi
      ? await this.responsesOpenAI(config)
      : await this.chatOpenAI(config);

    return { message };
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

    if (config.lmstudio?.host || config.lmstudio?.apiKey) {
      try {
        const lmsList = await this.fetchList(`${this.lmsBaseUrl}/api/v1/models`, config.lmstudio?.apiKey ? {
          Authorization: 'Bearer ' + config.lmstudio.apiKey
        } : {}) as { models: Record<any, string | number>[] };
        for (const m of lmsList.models) {
          modelList.push('lms/'+m.key);
        }
      } catch (err) {
        if (err instanceof Error)
          console.error(`failed to list lmstudio models: ${err.message}`);
      }
    }

    if (config.openai?.apiKey) {
      try {
        const openaiList = await this.fetchList(`${this.openaiBaseUrl}/v1/models`, {
          Authorization: 'Bearer ' + config.openai.apiKey
        }) as { data: Record<any, string | number>[] };
        for (const m of openaiList.data) {
          if (typeof m.id != 'string') continue;
          if (!this.isGenerativeModel(m.id)) continue;
          if (!(m.id.includes('gpt-') || m.id[0] == 'o'))
            continue
          modelList.push('openai/'+m.id);
        }
      } catch (err) {
        if (err instanceof Error)
          console.error(`failed to list openai models: ${err.message}`);
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
        if (err instanceof Error)
          console.error(`failed to list anthropic models: ${err.message}`);
      }
    }

    if (config.google?.apiKey) {
      try {
        const googleList = await this.fetchList(`${this.googleBaseUrl}/v1beta/models?key=${config.google.apiKey}`, {}) as { models: Record<any, string>[] };
        for (const m of googleList.models) {
          if (m.name && !(m.name.includes('gemini-') || m.name.includes('gemma-')))
            continue
          if (!this.isGenerativeModel(m.name ?? '')) continue;

          let name = m.name;
          if (name?.includes('/'))
            name = name.split('/')[1];
          modelList.push('google/'+name);
        }
      } catch (err) {
        if (err instanceof Error)
          console.error(`failed to list google models: ${err.message}`);
      }
    }

    if (config.groq?.apiKey) {
      try {
        const groqList = await this.fetchList(`${this.groqBaseUrl}/v1/models`, {
          "Authorization": 'Bearer ' + config.groq?.apiKey
        }) as { data: Record<any, string | number>[] };
        for (const m of groqList.data) {
          modelList.push('groq/'+m.id);
        }
      } catch (err) {
        if (err instanceof Error)
          console.error(`failed to list groq models: ${err.message}`);
      }
    }

    if (config.xai?.apiKey) {
      try {
        const xaiList = await this.fetchList(`${this.xaiBaseUrl}/v1/language-models`, {
          "Authorization": 'Bearer ' + config.xai.apiKey
        }) as { models: Record<any, string | number>[] };
        for (const m of xaiList.models) {
          modelList.push('xai/'+m.id);
        }
      } catch (err) {
        if (err instanceof Error)
          console.error(`failed to list xai models: ${err.message}`);
      }
    }

    return modelList;
  }

  // For OpenAI-compatible APIs
  protected async chatOpenAI(config: OpenAIConfig) {
    const baseUrl = config.baseUrl || this.openaiBaseUrl;
    const endpoint = config.endpoint || '/v1/chat/completions';
    const headers: Record<string, string> = {};

    if (config.apiKey) headers['Authorization'] = 'Bearer ' + config.apiKey;
    
    const body: any = {
      model: config.model,
      messages: config.messages,
      response_format: config.format?.type == 'json_schema' ? {
        type: config.format.type,
        json_schema: {
          name: config.format.name,
          schema: config.format.schema
        }
      } : (config.format || {
        type: 'text'
      }),
      stream: false
    }
    if (config.instruction) {
      body.messages.unshift({
        role: 'system',
        content: config.instruction
      })
    }
    if (config.temperature) body.temperature = config.temperature;
    if (config.reasoning || config.reasoning == null) body.reasoning_effort = config.reasoning;

    const response = await this.fetchGenerate(baseUrl + endpoint, headers, body);
    const choice = response.choices[0];
    return {
      role: choice.message.role,
      content: choice.message.content
    } as Message
  }

  protected async responsesOpenAI(config: OpenAIConfig) {
    const baseUrl = config.baseUrl || this.openaiBaseUrl;
    const endpoint = config.endpoint || '/v1/responses';
    const headers: Record<string, string> = {};

    if (config.apiKey) headers['Authorization'] = 'Bearer ' + config.apiKey;
    
    const body: any = {
      model: config.model,
      input: config.messages.map(m => ({
        role: m.role,
        type: "message",
        content: [
          {
            type: 'input_text',
            text: m.content
          }
        ]
      })),
      text: {
        format: config.format || {
          type: 'text'
        }
      },
      stream: false
    }
    if (config.instruction) body.instructions = config.instruction;
    if (config.temperature) body.temperature = config.temperature;
    if (config.reasoning) body.reasoning = {
      effort: config.reasoning
    }
    
    const response = await this.fetchGenerate(baseUrl+endpoint, headers, body);
    const content = response.output.filter((c: any) => c.type == 'message')[0];
    return {
      role: content.role,
      content: content.content[0].text
    } as Message;
  }

  public async generate(request: GenerateRequest) {
    const config = this.config;
    const { provider, model } = this.parseRequestModel(request.model);

    if (provider == 'ollama') {
      const headers = {
        Authorization: 'Bearer ' + config.ollama?.apiKey
      };
      try {
        const messages = this.withInstruction(request.messages, request.system);
        const { system: _system, ...requestBody } = request;

        const response = await this.fetchGenerate(`${this.ollamaBaseUrl}/api/chat`, headers, {
          ...requestBody,
          model,
          messages,
          stream: false,
          think: request.think ? 'high' : 'low',
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
        if (err instanceof FetchError) {
          const url = new URL(err.url);
          if (err.code == 'ConnectionRefused' && url.hostname == 'localhost')
            throw new Error('unable to access ollama instance. is ollama daemon running?');
          throw new Error(err.message);
        }
        throw err;
      }
    }
    
    try {
      if (provider == 'lms') {
        return this.generateOpenAICompatible(request, model, {
          baseUrl: this.lmsBaseUrl,
          apiKey: this.config.lmstudio?.apiKey
        });
      }

      if (provider == 'openai') {
        return this.generateOpenAICompatible(request, model, {
          apiKey: config.openai?.apiKey,
          useResponsesApi: true
        });
      }

      if (provider == 'groq') {
        return this.generateOpenAICompatible(request, model, {
          baseUrl: this.groqBaseUrl,
          apiKey: this.config.groq?.apiKey
        });
      }

      if (provider == 'xai') {
        return this.generateOpenAICompatible(request, model, {
          baseUrl: this.xaiBaseUrl,
          apiKey: this.config.xai?.apiKey
        });
      }

      if (provider == 'anthropic') {
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
          max_tokens: 1480,
          thinking: {
            type: request.think ? 'adaptive' : 'disabled',
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
      }

      if (provider == 'google')  {
        const headers = {
          'x-goog-api-key': config.google?.apiKey ?? ''
        };
        const body: any = {
          model,
          input: request.messages.map(m => ({
            type: m.role == 'user' ? 'user_input' : 'model_output',
            content: [
              {
                type: 'text',
                text: m.content
              }
            ]
          })),
          response_format: {
            type: 'text',
            mime_type: 'application/json',
            schema: this.config.scheme
          },
          generation_config: {
            thinking_level: request.think ? 'high' : 'minimal'
          },
          stream: false
        }
        if (request.system) body.system_instruction = request.system;
        const response = await this.fetchGenerate(`${this.googleBaseUrl}/v1/interactions`, headers, body);
        const { steps } = response;
        const content = steps.filter((s: any) => s.type == "model_output")[0].content;
        return {
          message: {
            role: 'assistant',
            content: content[0].text
          } as Message
        };
      }
    } catch (err) {
      if (err instanceof FetchError) {
        if (err.json?.error?.message && typeof err.json.error.message == 'string') {
          throw new Error(err.json.error.message);
        }
        throw new Error(err.message);
      }
      throw err;
    }

    throw new Error(`Invalid provider "${provider}" on ${request.model}`);
  }
}
