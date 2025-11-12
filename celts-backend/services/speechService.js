// services/speechService.js
// Mock STT + acoustic analysis. Replace with real cloud STT integration later.

const fs = require('fs');

const transcribeMock = async (audioUrl) => {
  // For now simulate: return static transcript & acoustic score
  // Later: download file and call Google Cloud Speech-to-Text / other STT
  return {
    transcript: 'This is a mocked transcript of the uploaded audio.',
    acousticScore: Math.floor(Math.random() * 3) + 6 // 6..8
  };
};

module.exports = { transcribe: transcribeMock };
