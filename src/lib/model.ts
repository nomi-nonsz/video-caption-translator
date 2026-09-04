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

// rewrite abstraction layer shit
export default class Model {
  private config: ModelConfig;

  protected openaiBaseUrl = 'https://api.openai.com';
  protected anthropicBaseUrl = 'https://api.anthropic.com';
  protected ollamaBaseUrl = 'https://localhost:11434';
  protected googleBaseUrl = 'https://generativelanguage.googleapis.com';
  protected groqBaseUrl = 'https://api.groq.com/openai';
  protected xaiBaseUrl = 'https://api.x.ai';

  public constructor(config: ModelConfig) {
    this.config = config;

    if (config.ollama?.host || config.ollama?.apiKey) this.ollamaBaseUrl = config.ollama.host || 'https://ollama.com';
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
    const words = ['image', 'embedding', 'tts', 'moderation', 'transcribe', 'audio', 'image'];

    for (const exc of words) {
      if (name.includes(exc))
        return false;
    }

    return true;
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
          if (typeof m.id != 'string') continue;
          if (!this.isGenerativeModel(m.id)) continue;
          if (!(m.id.includes('gpt-') || m.id[0] == 'o'))
            continue
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
        console.error(err);
        console.error('failed to list google models');
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
        console.error(err);
        console.error('failed to list groq models');
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
        console.error(err);
        console.error('failed to list xai models');
      }
    }

    return modelList;
  }

  public async generate(request: GenerateRequest) {
    const config = this.config;
    const rawModel = request.model.split('/');
    const provider = rawModel[0];
    const model = rawModel.length > 2 ? rawModel.slice(1, rawModel.length).join("/") : rawModel[1];

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

    if (provider == 'openai')  {
      const headers = {
        Authorization: 'Bearer ' + config.openai?.apiKey
      };
      const body: any = {
        model,
        input: request.messages.map(m => ({
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
          format: this.config.scheme ? {
            type: 'json_schema',
            name: 'translated_cues',
            schema: this.config.scheme
          } : {
            type: 'text',
          }
        },
        reasoning: {
          effort: request.think ? 'high' : 'low'
        },
        stream: false
      }
      if (request.system) body.instructions = request.system;
      if (request.options.temperature) body.temperature = request.options.temperature
      try {
        const response = await this.fetchGenerate(`${this.openaiBaseUrl}/v1/responses`, headers, body);
        const content = response.output.filter((c: any) => c.type == 'message')[0];
        return {
          message: {
            role: content.role,
            content: content.content[0].text
          } as Message
        };
      } catch (err) {
        if (err instanceof FetchError) {
          if (err.json?.error?.message && typeof err.json.error.message == 'string') {
            throw new Error(err.json.error.message);
          }
          throw new Error(err.message);
        }
        throw err;
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
      } catch (err) {
        if (err instanceof FetchError) {
          if (err.json?.error?.message && typeof err.json.error.message == 'string') {
            throw new Error(`${err.message}\n${err.json.error.message}`);
          }
          throw new Error(err.message);
        }
        throw err;
      }
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
      try {
        const response = await this.fetchGenerate(`${this.googleBaseUrl}/v1/interactions`, headers, body);
        const { steps } = response;
        const content = steps.filter((s: any) => s.type == "model_output")[0].content;
        return {
          message: {
            role: 'assistant',
            content: content[0].text
          } as Message
        };
      } catch (err) {
        if (err instanceof FetchError) {
          if (err.json?.error?.message && typeof err.json.error.message == 'string') {
            throw new Error(err.json.error.message);
          }
          throw new Error(err.message);
        }
        throw err;
      }
    }

    if (provider == 'groq')  {
      const headers = {
        Authorization: 'Bearer ' + config.groq?.apiKey
      };
      const body: any = {
        model,
        input: request.messages.map(m => ({
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
          format: this.config.scheme ? {
            type: 'json_schema',
            name: 'translated_cues',
            schema: this.config.scheme
          } : {
            type: 'text',
          }
        },
        stream: false
      }
      if (request.system) body.instructions = request.system;
      if (request.options.temperature) body.temperature = request.options.temperature
      if (request.think) body.reasoning.effort = 'medium'
      try {
        const response = await this.fetchGenerate(`${this.groqBaseUrl}/v1/responses`, headers, body);
        const content = response.output.filter((c: any) => c.type == 'message')[0];
        return {
          message: {
            role: content.role,
            content: content.content[0].text
          } as Message
        };
      } catch (err) {
        if (err instanceof FetchError) {
          if (err.json?.error?.message && typeof err.json.error.message == 'string') {
            throw new Error(err.json.error.message);
          }
          throw new Error(err.message);
        }
        throw err;
      }
    }

    if (provider == 'xai')  {
      const headers = {
        Authorization: 'Bearer ' + config.xai?.apiKey
      };
      const body: any = {
        model,
        input: request.messages,
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
      if (request.system) body.instructions = request.system;
      if (request.options.temperature) body.temperature = request.options.temperature
      try {
        const response = await this.fetchGenerate(`${this.xaiBaseUrl}/v1/responses`, headers, body);
        const content = response.output.filter((c: any) => c.type == 'message')[0];
        return {
          message: {
            role: content.role,
            content: content.content[0].text
          } as Message
        };
      } catch (err) {
        if (err instanceof FetchError) {
          if (err.json?.error?.message && typeof err.json.error.message == 'string') {
            throw new Error(err.json.error.message);
          }
          throw new Error(err.message);
        }
        throw err;
      }
    }

    throw new Error(`Invalid provider "${provider}" on ${request.model}`);
  }
}