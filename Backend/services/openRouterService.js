import { OpenRouter } from "@openrouter/sdk";

let openRouterInstance = null;

const getOpenRouter = () => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set in environment variables");
  }

  if (!openRouterInstance) {
    openRouterInstance = new OpenRouter({ apiKey });
  }

  return openRouterInstance;
};

/**
 * Returns a streaming iterator from OpenRouter chat endpoint.
 * Keep this isolated until you are ready to wire it into routes/controllers.
 */
export const streamOpenRouterChat = async ({ model, messages }) => {
  const client = getOpenRouter();

  return client.chat.send({
    model,
    messages,
    stream: true,
  });
};

/**
 * Convenience helper to collect a full text response from a streamed result.
 */
export const generateOpenRouterText = async ({ model, messages }) => {
  const stream = await streamOpenRouterChat({ model, messages });

  let text = "";
  let usage = null;

  for await (const chunk of stream) {
    const content = chunk?.choices?.[0]?.delta?.content;
    if (content) {
      text += content;
    }

    if (chunk?.usage) {
      usage = chunk.usage;
    }
  }

  return {
    text,
    usage,
  };
};
