import fs from 'fs';
import path from 'path';

const modules: Record<string, string[]> = {
  common: ['common'],
  errors: ['errors'],
  messages: ['messages'],
  menu: ['menu'],
  auth: ['auth'],
  verifyEmail: ['verifyEmail'],
  profile: ['profile'],
  bots: ['bots'],
  referrals: ['referrals'],
  trading: ['trading'],
  withdrawal: ['withdrawal'],
  deposit: ['deposit'],
  payments: ['payments'],
  kyc: ['kyc'],
  support: ['support'],
  copyTrading: ['copyTrading'],
  landing: ['landing']
};

export const splitLanguageFile = (lang: string, inputPath: string, outputDir: string) => {
  try {
    const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    
    Object.entries(modules).forEach(([moduleName, keys]) => {
      const moduleData: Record<string, any> = {};
      
      keys.forEach(key => {
        if (data[key]) {
          moduleData[key] = data[key];
        }
      });
      
      if (Object.keys(moduleData).length > 0) {
        const outputPath = path.join(outputDir, `${moduleName}.json`);
        fs.writeFileSync(outputPath, JSON.stringify(moduleData, null, 2));

      }
    });
  } catch (error) {

  }
};

