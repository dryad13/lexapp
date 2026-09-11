import { startOpenAIMock } from "./openai-mock.js";
import { OPENAI_MOCK_PORT } from "./env.js";

startOpenAIMock(OPENAI_MOCK_PORT).then(() => {
  console.log(`OpenAI mock listening on ${OPENAI_MOCK_PORT}`);
});
