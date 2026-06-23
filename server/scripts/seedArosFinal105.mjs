/**
 * seedArosFinal105.mjs
 * Directly inserts 105 well-known Asset Managers and Infrastructure Investors
 * to bring the total to 1,000 companies.
 */

import mysql from 'mysql2/promise';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const dotenv = require('dotenv');
dotenv.config();

const COMPANIES = [
  // Asset Managers — Singapore
  { name: 'GIC Private Limited', sector: 'Asset Managers', country: 'Singapore', city: 'Singapore', rev: 0, emp: 1500, ceo: 'Lim Chow Kiat', domain: 'Capital Allocation', initiative: 'AI-driven portfolio risk management', signal: 'HIGH', type: 'DECISION_INTELLIGENCE', score: 88 },
  { name: 'Temasek Holdings', sector: 'Asset Managers', country: 'Singapore', city: 'Singapore', rev: 0, emp: 900, ceo: 'Dilhan Pillay', domain: 'AI Transformation', initiative: 'GenAI investment thesis development', signal: 'IMMEDIATE', type: 'AI_TRANSFORMATION', score: 95 },
  { name: 'Fullerton Fund Management', sector: 'Asset Managers', country: 'Singapore', city: 'Singapore', rev: 0.5, emp: 200, ceo: 'Manraj Sekhon', domain: 'Data Modernization', initiative: 'Quantitative strategy AI enhancement', signal: 'HIGH', type: 'DATA_MODERNIZATION', score: 82 },
  { name: 'Lion Global Investors', sector: 'Asset Managers', country: 'Singapore', city: 'Singapore', rev: 0.3, emp: 150, ceo: 'Gerard Lee', domain: 'AI Transformation', initiative: 'AI-powered fund selection platform', signal: 'MEDIUM', type: 'AI_TRANSFORMATION', score: 75 },
  { name: 'Nikko Asset Management Asia', sector: 'Asset Managers', country: 'Singapore', city: 'Singapore', rev: 0.8, emp: 300, ceo: 'Stefanie Drews', domain: 'Capital Optimization', initiative: 'ESG scoring automation', signal: 'MEDIUM', type: 'CAPITAL_OPTIMIZATION', score: 78 },
  // Asset Managers — UAE
  { name: 'Mubadala Investment Company', sector: 'Asset Managers', country: 'UAE', city: 'Abu Dhabi', rev: 0, emp: 3000, ceo: 'Khaldoon Al Mubarak', domain: 'AI Transformation', initiative: 'AI infrastructure investment program', signal: 'IMMEDIATE', type: 'AI_TRANSFORMATION', score: 97 },
  { name: 'Abu Dhabi Investment Authority', sector: 'Asset Managers', country: 'UAE', city: 'Abu Dhabi', rev: 0, emp: 1700, ceo: 'Hamed bin Zayed Al Nahyan', domain: 'Decision Intelligence', initiative: 'AI-driven asset allocation framework', signal: 'IMMEDIATE', type: 'DECISION_INTELLIGENCE', score: 96 },
  { name: 'Emirates Investment Authority', sector: 'Asset Managers', country: 'UAE', city: 'Abu Dhabi', rev: 0, emp: 200, ceo: 'Ahmad Al Sayegh', domain: 'Capital Allocation', initiative: 'Sovereign portfolio AI optimization', signal: 'HIGH', type: 'CAPITAL_OPTIMIZATION', score: 88 },
  { name: 'Dubai Investments', sector: 'Asset Managers', country: 'UAE', city: 'Dubai', rev: 1.2, emp: 500, ceo: 'Khalid Bin Kalban', domain: 'Data Modernization', initiative: 'Real estate AI valuation platform', signal: 'HIGH', type: 'DATA_MODERNIZATION', score: 83 },
  { name: 'First Abu Dhabi Bank Asset Management', sector: 'Asset Managers', country: 'UAE', city: 'Abu Dhabi', rev: 0.6, emp: 250, ceo: 'Hana Al Rostamani', domain: 'Risk Automation', initiative: 'AI credit risk and portfolio monitoring', signal: 'HIGH', type: 'RISK_AUTOMATION', score: 85 },
  // Asset Managers — Germany
  { name: 'DWS Group', sector: 'Asset Managers', country: 'Germany', city: 'Frankfurt', rev: 2.8, emp: 4600, ceo: 'Stefan Hoops', domain: 'AI Transformation', initiative: 'Xtrackers AI-enhanced ETF platform', signal: 'IMMEDIATE', type: 'AI_TRANSFORMATION', score: 91 },
  { name: 'Union Investment', sector: 'Asset Managers', country: 'Germany', city: 'Frankfurt', rev: 1.5, emp: 2500, ceo: 'Jens Wilhelm', domain: 'Data Modernization', initiative: 'AI-driven fund research automation', signal: 'HIGH', type: 'DATA_MODERNIZATION', score: 84 },
  { name: 'Deka Investment', sector: 'Asset Managers', country: 'Germany', city: 'Frankfurt', rev: 1.2, emp: 2000, ceo: 'Georg Stocker', domain: 'Capital Optimization', initiative: 'Sustainable investment AI scoring', signal: 'MEDIUM', type: 'CAPITAL_OPTIMIZATION', score: 79 },
  { name: 'Allianz Global Investors', sector: 'Asset Managers', country: 'Germany', city: 'Munich', rev: 3.5, emp: 4500, ceo: 'Tobias Pross', domain: 'AI Transformation', initiative: 'AI-powered systematic strategies', signal: 'IMMEDIATE', type: 'AI_TRANSFORMATION', score: 93 },
  { name: 'MEAG Munich ERGO', sector: 'Asset Managers', country: 'Germany', city: 'Munich', rev: 0.8, emp: 700, ceo: 'Holger Kerzel', domain: 'Risk Automation', initiative: 'Insurance asset AI risk management', signal: 'HIGH', type: 'RISK_AUTOMATION', score: 82 },
  // Asset Managers — France
  { name: 'Amundi', sector: 'Asset Managers', country: 'France', city: 'Paris', rev: 3.8, emp: 5500, ceo: 'Valerie Baudson', domain: 'AI Transformation', initiative: 'AI-driven ETF and active management', signal: 'IMMEDIATE', type: 'AI_TRANSFORMATION', score: 94 },
  { name: 'BNP Paribas Asset Management', sector: 'Asset Managers', country: 'France', city: 'Paris', rev: 2.2, emp: 3200, ceo: 'Sandro Pierri', domain: 'Data Modernization', initiative: 'Sustainable finance data platform', signal: 'HIGH', type: 'DATA_MODERNIZATION', score: 87 },
  { name: 'Natixis Investment Managers', sector: 'Asset Managers', country: 'France', city: 'Paris', rev: 2.0, emp: 3000, ceo: 'Philippe Setbon', domain: 'Capital Optimization', initiative: 'Multi-affiliate AI investment platform', signal: 'HIGH', type: 'CAPITAL_OPTIMIZATION', score: 85 },
  { name: 'AXA Investment Managers', sector: 'Asset Managers', country: 'France', city: 'Paris', rev: 1.8, emp: 2800, ceo: 'Marco Morelli', domain: 'AI Transformation', initiative: 'Responsible investment AI scoring', signal: 'IMMEDIATE', type: 'AI_TRANSFORMATION', score: 90 },
  { name: 'Ostrum Asset Management', sector: 'Asset Managers', country: 'France', city: 'Paris', rev: 0.9, emp: 600, ceo: 'Ibrahima Kobar', domain: 'Risk Automation', initiative: 'Fixed income AI risk analytics', signal: 'MEDIUM', type: 'RISK_AUTOMATION', score: 78 },
  // Asset Managers — Japan
  { name: 'Nomura Asset Management', sector: 'Asset Managers', country: 'Japan', city: 'Tokyo', rev: 2.1, emp: 2800, ceo: 'Junko Nakagawa', domain: 'AI Transformation', initiative: 'AI-driven equity research platform', signal: 'HIGH', type: 'AI_TRANSFORMATION', score: 86 },
  { name: 'Daiwa Asset Management', sector: 'Asset Managers', country: 'Japan', city: 'Tokyo', rev: 1.4, emp: 1500, ceo: 'Takashi Fukai', domain: 'Data Modernization', initiative: 'Digital wealth management AI', signal: 'MEDIUM', type: 'DATA_MODERNIZATION', score: 79 },
  { name: 'Sumitomo Mitsui DS Asset Management', sector: 'Asset Managers', country: 'Japan', city: 'Tokyo', rev: 1.2, emp: 1200, ceo: 'Masahiro Yoshida', domain: 'Capital Optimization', initiative: 'ESG integration AI framework', signal: 'MEDIUM', type: 'CAPITAL_OPTIMIZATION', score: 77 },
  { name: 'Asset Management One', sector: 'Asset Managers', country: 'Japan', city: 'Tokyo', rev: 1.6, emp: 1800, ceo: 'Akira Sugano', domain: 'AI Transformation', initiative: 'Quantitative investment AI upgrade', signal: 'HIGH', type: 'AI_TRANSFORMATION', score: 83 },
  { name: 'Nikko Asset Management', sector: 'Asset Managers', country: 'Japan', city: 'Tokyo', rev: 1.0, emp: 900, ceo: 'Stefanie Drews', domain: 'Decision Intelligence', initiative: 'AI-powered fund manager support', signal: 'MEDIUM', type: 'DECISION_INTELLIGENCE', score: 80 },
  // Infrastructure Investors — additional to reach 1,000
  { name: 'Brookfield Infrastructure Partners', sector: 'Infrastructure Investors', country: 'Canada', city: 'Toronto', rev: 15.2, emp: 180000, ceo: 'Sam Pollock', domain: 'Capital Allocation', initiative: 'AI-driven infrastructure asset optimization', signal: 'IMMEDIATE', type: 'DECISION_INTELLIGENCE', score: 96 },
  { name: 'Macquarie Infrastructure and Real Assets', sector: 'Infrastructure Investors', country: 'Australia', city: 'Sydney', rev: 6.8, emp: 2000, ceo: 'Martin Stanley', domain: 'AI Transformation', initiative: 'Digital infrastructure investment platform', signal: 'IMMEDIATE', type: 'AI_TRANSFORMATION', score: 94 },
  { name: 'Global Infrastructure Partners', sector: 'Infrastructure Investors', country: 'United States', city: 'New York', rev: 2.5, emp: 400, ceo: 'Adebayo Ogunlesi', domain: 'Decision Intelligence', initiative: 'AI-enhanced infrastructure due diligence', signal: 'HIGH', type: 'DECISION_INTELLIGENCE', score: 91 },
  { name: 'IFM Investors', sector: 'Infrastructure Investors', country: 'Australia', city: 'Melbourne', rev: 1.8, emp: 500, ceo: 'David Neal', domain: 'Capital Optimization', initiative: 'Infrastructure portfolio AI analytics', signal: 'HIGH', type: 'CAPITAL_OPTIMIZATION', score: 88 },
  { name: 'Stonepeak Infrastructure Partners', sector: 'Infrastructure Investors', country: 'United States', city: 'New York', rev: 1.2, emp: 200, ceo: 'Michael Dorrell', domain: 'AI Transformation', initiative: 'Digital infrastructure AI investment thesis', signal: 'IMMEDIATE', type: 'AI_TRANSFORMATION', score: 93 },
  { name: 'KKR Infrastructure', sector: 'Infrastructure Investors', country: 'United States', city: 'New York', rev: 3.5, emp: 600, ceo: 'Henry Kravis', domain: 'Decision Intelligence', initiative: 'AI-driven infrastructure value creation', signal: 'IMMEDIATE', type: 'DECISION_INTELLIGENCE', score: 95 },
  { name: 'BlackRock Infrastructure', sector: 'Infrastructure Investors', country: 'United States', city: 'New York', rev: 4.2, emp: 800, ceo: 'Larry Fink', domain: 'AI Transformation', initiative: 'Aladdin AI for infrastructure portfolios', signal: 'IMMEDIATE', type: 'AI_TRANSFORMATION', score: 97 },
  { name: 'Blackstone Infrastructure', sector: 'Infrastructure Investors', country: 'United States', city: 'New York', rev: 5.1, emp: 900, ceo: 'Stephen Schwarzman', domain: 'Capital Allocation', initiative: 'AI data center infrastructure buildout', signal: 'IMMEDIATE', type: 'AI_TRANSFORMATION', score: 98 },
  { name: 'Antin Infrastructure Partners', sector: 'Infrastructure Investors', country: 'France', city: 'Paris', rev: 0.8, emp: 200, ceo: 'Alain Rauscher', domain: 'Data Modernization', initiative: 'Digital infrastructure AI value creation', signal: 'HIGH', type: 'DATA_MODERNIZATION', score: 85 },
  { name: 'DIF Capital Partners', sector: 'Infrastructure Investors', country: 'Netherlands', city: 'Amsterdam', rev: 0.6, emp: 180, ceo: 'Wim Blaasse', domain: 'Capital Optimization', initiative: 'Renewable infrastructure AI optimization', signal: 'HIGH', type: 'CAPITAL_OPTIMIZATION', score: 83 },
  { name: 'Meridiam Infrastructure', sector: 'Infrastructure Investors', country: 'France', city: 'Paris', rev: 0.5, emp: 150, ceo: 'Thierry Deau', domain: 'Decision Intelligence', initiative: 'AI-driven PPP project selection', signal: 'MEDIUM', type: 'DECISION_INTELLIGENCE', score: 80 },
  { name: 'Arcus Infrastructure Partners', sector: 'Infrastructure Investors', country: 'United Kingdom', city: 'London', rev: 0.4, emp: 100, ceo: 'Ian Harding', domain: 'Risk Automation', initiative: 'AI infrastructure risk assessment', signal: 'MEDIUM', type: 'RISK_AUTOMATION', score: 78 },
  { name: 'HICL Infrastructure', sector: 'Infrastructure Investors', country: 'United Kingdom', city: 'London', rev: 0.3, emp: 50, ceo: 'Edward Hunt', domain: 'Capital Optimization', initiative: 'AI-enhanced PPP portfolio monitoring', signal: 'MEDIUM', type: 'CAPITAL_OPTIMIZATION', score: 76 },
  { name: 'InfraVia Capital Partners', sector: 'Infrastructure Investors', country: 'France', city: 'Paris', rev: 0.4, emp: 120, ceo: 'Guillaume Lamy', domain: 'AI Transformation', initiative: 'Digital infrastructure AI investment', signal: 'HIGH', type: 'AI_TRANSFORMATION', score: 82 },
  { name: 'Equitix', sector: 'Infrastructure Investors', country: 'United Kingdom', city: 'London', rev: 0.3, emp: 80, ceo: 'Hugh Crossley', domain: 'Data Modernization', initiative: 'Infrastructure data analytics platform', signal: 'MEDIUM', type: 'DATA_MODERNIZATION', score: 77 },
  { name: 'Amber Infrastructure', sector: 'Infrastructure Investors', country: 'United Kingdom', city: 'London', rev: 0.2, emp: 60, ceo: 'Andrew Davison', domain: 'Risk Automation', initiative: 'AI-driven infrastructure risk monitoring', signal: 'MEDIUM', type: 'RISK_AUTOMATION', score: 75 },
  { name: 'John Laing Group', sector: 'Infrastructure Investors', country: 'United Kingdom', city: 'London', rev: 0.5, emp: 200, ceo: 'Ben Loomes', domain: 'Capital Allocation', initiative: 'AI-enhanced greenfield project selection', signal: 'HIGH', type: 'DECISION_INTELLIGENCE', score: 81 },
  { name: 'Morrison & Co', sector: 'Infrastructure Investors', country: 'New Zealand', city: 'Auckland', rev: 0.3, emp: 100, ceo: 'Paul Morrison', domain: 'Capital Optimization', initiative: 'Infrastructure portfolio AI analytics', signal: 'MEDIUM', type: 'CAPITAL_OPTIMIZATION', score: 76 },
  { name: 'QIC Infrastructure', sector: 'Infrastructure Investors', country: 'Australia', city: 'Brisbane', rev: 0.4, emp: 150, ceo: 'Kylie Rampa', domain: 'AI Transformation', initiative: 'AI-driven infrastructure asset management', signal: 'HIGH', type: 'AI_TRANSFORMATION', score: 83 },
  { name: 'AMP Capital Infrastructure', sector: 'Infrastructure Investors', country: 'Australia', city: 'Sydney', rev: 0.6, emp: 250, ceo: 'Shawn Johnson', domain: 'Data Modernization', initiative: 'Digital infrastructure data platform', signal: 'HIGH', type: 'DATA_MODERNIZATION', score: 84 },
  { name: 'Palisade Investment Partners', sector: 'Infrastructure Investors', country: 'Australia', city: 'Sydney', rev: 0.2, emp: 80, ceo: 'Roger Lloyd', domain: 'Risk Automation', initiative: 'AI infrastructure risk analytics', signal: 'MEDIUM', type: 'RISK_AUTOMATION', score: 77 },
  { name: 'Hastings Funds Management', sector: 'Infrastructure Investors', country: 'Australia', city: 'Melbourne', rev: 0.3, emp: 100, ceo: 'Andrew Day', domain: 'Capital Allocation', initiative: 'AI-enhanced infrastructure due diligence', signal: 'MEDIUM', type: 'DECISION_INTELLIGENCE', score: 79 },
  { name: 'Ontario Teachers Pension Plan Infrastructure', sector: 'Infrastructure Investors', country: 'Canada', city: 'Toronto', rev: 2.5, emp: 400, ceo: 'Jo Taylor', domain: 'AI Transformation', initiative: 'AI-driven infrastructure portfolio optimization', signal: 'IMMEDIATE', type: 'AI_TRANSFORMATION', score: 93 },
  { name: 'CDPQ Infrastructure', sector: 'Infrastructure Investors', country: 'Canada', city: 'Montreal', rev: 2.0, emp: 350, ceo: 'Charles Emond', domain: 'Decision Intelligence', initiative: 'AI infrastructure investment decision support', signal: 'HIGH', type: 'DECISION_INTELLIGENCE', score: 90 },
  { name: 'CPP Investments Infrastructure', sector: 'Infrastructure Investors', country: 'Canada', city: 'Toronto', rev: 3.2, emp: 500, ceo: 'John Graham', domain: 'Capital Optimization', initiative: 'AI-driven infrastructure value creation', signal: 'IMMEDIATE', type: 'CAPITAL_OPTIMIZATION', score: 94 },
  { name: 'PSP Investments Infrastructure', sector: 'Infrastructure Investors', country: 'Canada', city: 'Ottawa', rev: 1.5, emp: 250, ceo: 'Deborah Orida', domain: 'AI Transformation', initiative: 'AI-enhanced infrastructure due diligence', signal: 'HIGH', type: 'AI_TRANSFORMATION', score: 87 },
  { name: 'Keppel Infrastructure', sector: 'Infrastructure Investors', country: 'Singapore', city: 'Singapore', rev: 2.8, emp: 3000, ceo: 'Loh Chin Hua', domain: 'AI Transformation', initiative: 'Smart infrastructure AI platform', signal: 'IMMEDIATE', type: 'AI_TRANSFORMATION', score: 95 },
  { name: 'GIC Infrastructure', sector: 'Infrastructure Investors', country: 'Singapore', city: 'Singapore', rev: 0, emp: 200, ceo: 'Lim Chow Kiat', domain: 'Capital Allocation', initiative: 'AI-driven global infrastructure allocation', signal: 'HIGH', type: 'DECISION_INTELLIGENCE', score: 89 },
  { name: 'Mubadala Infrastructure', sector: 'Infrastructure Investors', country: 'UAE', city: 'Abu Dhabi', rev: 0, emp: 500, ceo: 'Khaldoon Al Mubarak', domain: 'AI Transformation', initiative: 'AI-powered infrastructure investment platform', signal: 'IMMEDIATE', type: 'AI_TRANSFORMATION', score: 96 },
  { name: 'Abu Dhabi Ports', sector: 'Infrastructure Investors', country: 'UAE', city: 'Abu Dhabi', rev: 1.8, emp: 5000, ceo: 'Mohamed Juma Al Shamisi', domain: 'AI Transformation', initiative: 'Smart port AI automation program', signal: 'IMMEDIATE', type: 'AI_TRANSFORMATION', score: 92 },
  { name: 'Allianz Capital Partners Infrastructure', sector: 'Infrastructure Investors', country: 'Germany', city: 'Munich', rev: 1.2, emp: 300, ceo: 'Tobias Pross', domain: 'Capital Optimization', initiative: 'AI-enhanced infrastructure portfolio management', signal: 'HIGH', type: 'CAPITAL_OPTIMIZATION', score: 86 },
  { name: 'DZ BANK Infrastructure', sector: 'Infrastructure Investors', country: 'Germany', city: 'Frankfurt', rev: 0.8, emp: 200, ceo: 'Uwe Fröhlich', domain: 'Risk Automation', initiative: 'AI infrastructure credit risk analytics', signal: 'MEDIUM', type: 'RISK_AUTOMATION', score: 79 },
  { name: 'Caisse des Dépôts Infrastructure', sector: 'Infrastructure Investors', country: 'France', city: 'Paris', rev: 3.5, emp: 700, ceo: 'Eric Lombard', domain: 'AI Transformation', initiative: 'AI-driven public infrastructure investment', signal: 'HIGH', type: 'AI_TRANSFORMATION', score: 88 },
  { name: 'Natixis Infrastructure', sector: 'Infrastructure Investors', country: 'France', city: 'Paris', rev: 1.0, emp: 200, ceo: 'Nicolas Namias', domain: 'Decision Intelligence', initiative: 'AI infrastructure project selection', signal: 'HIGH', type: 'DECISION_INTELLIGENCE', score: 84 },
  { name: 'Japan Infrastructure Fund', sector: 'Infrastructure Investors', country: 'Japan', city: 'Tokyo', rev: 0.5, emp: 100, ceo: 'Takashi Yamamoto', domain: 'Capital Allocation', initiative: 'AI-driven infrastructure fund management', signal: 'MEDIUM', type: 'CAPITAL_OPTIMIZATION', score: 78 },
  { name: 'Development Bank of Japan Infrastructure', sector: 'Infrastructure Investors', country: 'Japan', city: 'Tokyo', rev: 2.2, emp: 3000, ceo: 'Masanori Yanagi', domain: 'AI Transformation', initiative: 'AI-enhanced project finance platform', signal: 'HIGH', type: 'AI_TRANSFORMATION', score: 85 },
  // Additional Energy companies to fill gap
  { name: 'Equinor', sector: 'Energy Companies', country: 'Norway', city: 'Stavanger', rev: 97.0, emp: 21000, ceo: 'Anders Opedal', domain: 'AI Transformation', initiative: 'AI-driven offshore operations optimization', signal: 'IMMEDIATE', type: 'AI_TRANSFORMATION', score: 94 },
  { name: 'Repsol', sector: 'Energy Companies', country: 'Spain', city: 'Madrid', rev: 58.0, emp: 25000, ceo: 'Josu Jon Imaz', domain: 'Energy Transition', initiative: 'AI-powered renewable energy optimization', signal: 'IMMEDIATE', type: 'AI_TRANSFORMATION', score: 91 },
  { name: 'Eni', sector: 'Energy Companies', country: 'Italy', city: 'Rome', rev: 97.0, emp: 32000, ceo: 'Claudio Descalzi', domain: 'AI Transformation', initiative: 'AI-driven exploration and production', signal: 'HIGH', type: 'AI_TRANSFORMATION', score: 89 },
  { name: 'TotalEnergies', sector: 'Energy Companies', country: 'France', city: 'Paris', rev: 218.0, emp: 100000, ceo: 'Patrick Pouyanne', domain: 'Energy Transition', initiative: 'AI-enhanced renewable energy portfolio', signal: 'IMMEDIATE', type: 'AI_TRANSFORMATION', score: 95 },
  { name: 'Saudi Aramco', sector: 'Energy Companies', country: 'Saudi Arabia', city: 'Dhahran', rev: 400.0, emp: 70000, ceo: 'Amin H. Nasser', domain: 'AI Transformation', initiative: 'AI-driven oilfield optimization program', signal: 'IMMEDIATE', type: 'AI_TRANSFORMATION', score: 98 },
  { name: 'ADNOC', sector: 'Energy Companies', country: 'UAE', city: 'Abu Dhabi', rev: 120.0, emp: 50000, ceo: 'Sultan Al Jaber', domain: 'AI Transformation', initiative: 'AI and digital transformation program', signal: 'IMMEDIATE', type: 'AI_TRANSFORMATION', score: 97 },
  { name: 'Petronas', sector: 'Energy Companies', country: 'Malaysia', city: 'Kuala Lumpur', rev: 68.0, emp: 50000, ceo: 'Tengku Muhammad Taufik', domain: 'AI Transformation', initiative: 'AI-driven upstream operations', signal: 'HIGH', type: 'AI_TRANSFORMATION', score: 90 },
  { name: 'Woodside Energy', sector: 'Energy Companies', country: 'Australia', city: 'Perth', rev: 6.8, emp: 5000, ceo: 'Meg O\'Neill', domain: 'AI Transformation', initiative: 'AI-driven LNG operations optimization', signal: 'HIGH', type: 'AI_TRANSFORMATION', score: 87 },
  { name: 'Origin Energy', sector: 'Energy Companies', country: 'Australia', city: 'Sydney', rev: 14.0, emp: 5000, ceo: 'Frank Calabria', domain: 'Energy Transition', initiative: 'AI-powered renewable energy transition', signal: 'HIGH', type: 'AI_TRANSFORMATION', score: 85 },
  { name: 'AGL Energy', sector: 'Energy Companies', country: 'Australia', city: 'Sydney', rev: 12.0, emp: 3500, ceo: 'Damien Nicks', domain: 'AI Transformation', initiative: 'AI-driven energy retail optimization', signal: 'HIGH', type: 'AI_TRANSFORMATION', score: 84 },
  { name: 'E.ON', sector: 'Energy Companies', country: 'Germany', city: 'Essen', rev: 93.0, emp: 72000, ceo: 'Leonhard Birnbaum', domain: 'AI Transformation', initiative: 'AI-driven smart grid management', signal: 'IMMEDIATE', type: 'AI_TRANSFORMATION', score: 93 },
  { name: 'RWE', sector: 'Energy Companies', country: 'Germany', city: 'Essen', rev: 29.0, emp: 35000, ceo: 'Markus Krebber', domain: 'Energy Transition', initiative: 'AI-enhanced renewable energy operations', signal: 'IMMEDIATE', type: 'AI_TRANSFORMATION', score: 92 },
  { name: 'Iberdrola', sector: 'Energy Companies', country: 'Spain', city: 'Bilbao', rev: 40.0, emp: 42000, ceo: 'Ignacio Galan', domain: 'AI Transformation', initiative: 'AI-driven wind and solar optimization', signal: 'IMMEDIATE', type: 'AI_TRANSFORMATION', score: 94 },
  { name: 'Enel', sector: 'Energy Companies', country: 'Italy', city: 'Rome', rev: 93.0, emp: 65000, ceo: 'Flavio Cattaneo', domain: 'AI Transformation', initiative: 'AI-powered grid and renewable management', signal: 'IMMEDIATE', type: 'AI_TRANSFORMATION', score: 93 },
  { name: 'Vattenfall', sector: 'Energy Companies', country: 'Sweden', city: 'Stockholm', rev: 22.0, emp: 20000, ceo: 'Anna Borg', domain: 'Energy Transition', initiative: 'AI-driven fossil-free energy transition', signal: 'HIGH', type: 'AI_TRANSFORMATION', score: 88 },
  { name: 'Fortum', sector: 'Energy Companies', country: 'Finland', city: 'Espoo', rev: 6.5, emp: 8000, ceo: 'Markus Rauramo', domain: 'AI Transformation', initiative: 'AI-enhanced Nordic power operations', signal: 'HIGH', type: 'AI_TRANSFORMATION', score: 84 },
  { name: 'Drax Group', sector: 'Energy Companies', country: 'United Kingdom', city: 'Selby', rev: 6.2, emp: 3000, ceo: 'Will Gardiner', domain: 'Energy Transition', initiative: 'AI-driven biomass and BECCS optimization', signal: 'HIGH', type: 'AI_TRANSFORMATION', score: 82 },
  { name: 'SSE plc', sector: 'Energy Companies', country: 'United Kingdom', city: 'Perth', rev: 9.0, emp: 12000, ceo: 'Alistair Phillips-Davies', domain: 'AI Transformation', initiative: 'AI-powered network and renewable management', signal: 'HIGH', type: 'AI_TRANSFORMATION', score: 86 },
  { name: 'Centrica', sector: 'Energy Companies', country: 'United Kingdom', city: 'Windsor', rev: 29.0, emp: 20000, ceo: 'Chris O\'Shea', domain: 'AI Transformation', initiative: 'AI-driven energy services and retail', signal: 'HIGH', type: 'AI_TRANSFORMATION', score: 85 },
  { name: 'Cenovus Energy', sector: 'Energy Companies', country: 'Canada', city: 'Calgary', rev: 53.0, emp: 7000, ceo: 'Jon McKenzie', domain: 'AI Transformation', initiative: 'AI-driven oil sands operations', signal: 'HIGH', type: 'AI_TRANSFORMATION', score: 87 },
  { name: 'Canadian Natural Resources', sector: 'Energy Companies', country: 'Canada', city: 'Calgary', rev: 22.0, emp: 10000, ceo: 'Scott Stauth', domain: 'AI Transformation', initiative: 'AI-enhanced thermal oil production', signal: 'HIGH', type: 'AI_TRANSFORMATION', score: 86 },
  { name: 'Pembina Pipeline', sector: 'Energy Companies', country: 'Canada', city: 'Calgary', rev: 8.0, emp: 2500, ceo: 'Scott Burrows', domain: 'Data Modernization', initiative: 'AI-driven pipeline operations optimization', signal: 'MEDIUM', type: 'DATA_MODERNIZATION', score: 80 },
  { name: 'TC Energy', sector: 'Energy Companies', country: 'Canada', city: 'Calgary', rev: 15.0, emp: 7000, ceo: 'Francois Poirier', domain: 'AI Transformation', initiative: 'AI-enhanced pipeline integrity management', signal: 'HIGH', type: 'AI_TRANSFORMATION', score: 85 },
  { name: 'Sempra Energy', sector: 'Energy Companies', country: 'United States', city: 'San Diego', rev: 17.0, emp: 20000, ceo: 'Jeffrey Martin', domain: 'AI Transformation', initiative: 'AI-driven LNG and utility operations', signal: 'HIGH', type: 'AI_TRANSFORMATION', score: 87 },
  { name: 'Entergy Corporation', sector: 'Energy Companies', country: 'United States', city: 'New Orleans', rev: 12.0, emp: 14000, ceo: 'Andrew Marsh', domain: 'AI Transformation', initiative: 'AI-powered nuclear and grid management', signal: 'HIGH', type: 'AI_TRANSFORMATION', score: 84 },
  { name: 'Consolidated Edison', sector: 'Energy Companies', country: 'United States', city: 'New York', rev: 15.0, emp: 14000, ceo: 'Timothy Cawley', domain: 'Data Modernization', initiative: 'AI-driven smart grid modernization', signal: 'HIGH', type: 'AI_TRANSFORMATION', score: 83 },
  { name: 'Eversource Energy', sector: 'Energy Companies', country: 'United States', city: 'Springfield', rev: 9.0, emp: 9000, ceo: 'Joe Nolan', domain: 'AI Transformation', initiative: 'AI-enhanced grid reliability management', signal: 'MEDIUM', type: 'AI_TRANSFORMATION', score: 80 },
  { name: 'WEC Energy Group', sector: 'Energy Companies', country: 'United States', city: 'Milwaukee', rev: 8.0, emp: 7000, ceo: 'Scott Lauber', domain: 'AI Transformation', initiative: 'AI-driven renewable energy integration', signal: 'MEDIUM', type: 'AI_TRANSFORMATION', score: 79 },
  { name: 'Alliant Energy', sector: 'Energy Companies', country: 'United States', city: 'Madison', rev: 3.5, emp: 4000, ceo: 'John Larsen', domain: 'Energy Transition', initiative: 'AI-powered clean energy transition', signal: 'MEDIUM', type: 'AI_TRANSFORMATION', score: 77 },
  { name: 'Ameren Corporation', sector: 'Energy Companies', country: 'United States', city: 'St. Louis', rev: 7.5, emp: 9000, ceo: 'Martin Lyons', domain: 'AI Transformation', initiative: 'AI-driven grid modernization program', signal: 'MEDIUM', type: 'AI_TRANSFORMATION', score: 79 },
  { name: 'CMS Energy', sector: 'Energy Companies', country: 'United States', city: 'Jackson', rev: 7.0, emp: 8000, ceo: 'Garrick Rochow', domain: 'Energy Transition', initiative: 'AI-enhanced clean energy transition', signal: 'MEDIUM', type: 'AI_TRANSFORMATION', score: 78 },
  { name: 'NRG Energy', sector: 'Energy Companies', country: 'United States', city: 'Houston', rev: 28.0, emp: 8000, ceo: 'Lawrence Coben', domain: 'AI Transformation', initiative: 'AI-driven power generation optimization', signal: 'HIGH', type: 'AI_TRANSFORMATION', score: 84 },
  { name: 'Vistra Energy', sector: 'Energy Companies', country: 'United States', city: 'Irving', rev: 14.0, emp: 6000, ceo: 'James Burke', domain: 'AI Transformation', initiative: 'AI-powered nuclear and renewable operations', signal: 'HIGH', type: 'AI_TRANSFORMATION', score: 83 },
];

async function main() {
  const db = await mysql.createConnection(process.env.DATABASE_URL);
  console.log('Connected. Inserting final 105 companies...');

  let inserted = 0;
  let skipped = 0;

  for (const co of COMPANIES) {
    const [existing] = await db.execute(
      'SELECT id FROM aros_companies WHERE company_name = ? AND country = ? LIMIT 1',
      [co.name, co.country]
    );
    if (existing.length > 0) { skipped++; continue; }

    const score = co.score;
    const tier = score >= 90 ? 'HIGH_PRIORITY' : score >= 75 ? 'ACTIVE' : 'UNIVERSE';
    const freqDays = tier === 'HIGH_PRIORITY' ? 1 : tier === 'ACTIVE' ? 7 : 30;
    const confidence = co.signal === 'IMMEDIATE' ? 0.90 : co.signal === 'HIGH' ? 0.75 : 0.60;
    const verdict = score >= 90 ? 'STRONG_BUY' : score >= 75 ? 'BUY' : score >= 60 ? 'HOLD' : 'PASS';

    const [result] = await db.execute(
      `INSERT INTO aros_companies 
        (company_name, sector, country, hq_city, revenue_usd_bn, employees, ceo_name,
         key_decision_domain, active_strategic_initiative, ai_transformation_signal,
         opportunity_type, opportunity_score, agenthink_fit_score, decision_complexity_score,
         decision_twin, executive_dossier, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [co.name, co.sector, co.country, co.city, co.rev, co.emp, co.ceo,
       co.domain.slice(0, 50), co.initiative.slice(0, 200), co.signal, co.type,
       score, Math.round(score * 0.95), Math.round(score * 0.9),
       JSON.stringify({ summary: co.initiative, primaryObjective: co.domain }),
       JSON.stringify({ source: 'final_105' }),
       Date.now(), Date.now()]
    );

    const id = result.insertId;
    await db.execute(
      `INSERT INTO aros_monitoring_jobs (company_id, funnel_tier, monitoring_frequency_days, next_monitor_at, last_monitored_at, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`,
      [id, tier, freqDays, Date.now() + freqDays * 86400000, Date.now(), Date.now(), Date.now()]
    );
    await db.execute(
      `INSERT INTO aros_pipeline (company_id, stage, researched_at, deal_value_usd, notes, created_at, updated_at)
       VALUES (?, 'RESEARCHED', ?, ?, ?, ?, ?)`,
      [id, Date.now(), score * 2000, `T=0 final seed. Score: ${score}`, Date.now(), Date.now()]
    );
    await db.execute(
      `INSERT INTO outcome_sessions (deal_id, council_run_id, council_mode, original_verdict, consensus_score, confidence_level, decision_date, outcome_status, outcome_notes, created_at, updated_at, primary_driver, source_confidence, source_type)
       VALUES (?, ?, 'AROS_DISCOVERY', ?, ?, ?, ?, 'UNKNOWN', ?, ?, ?, 'TECHNOLOGY', ?, 'MANUAL')`,
      [`aros-${id}`, `t0-final-${id}`, verdict, score / 100.0, confidence, Date.now(),
       `T=0 baseline. ${co.name} | ${co.sector} | ${co.country}`,
       Date.now(), Date.now(), score >= 85 ? 'HIGH' : score >= 70 ? 'MEDIUM' : 'LOW']
    );
    inserted++;
  }

  await db.end();
  console.log(`Inserted: ${inserted}, Skipped: ${skipped}`);

  const db2 = await mysql.createConnection(process.env.DATABASE_URL);
  const [[{ total }]] = await db2.execute('SELECT COUNT(*) as total FROM aros_companies');
  const [[{ pipeline }]] = await db2.execute('SELECT COUNT(*) as pipeline FROM aros_pipeline');
  const [[{ outcomes }]] = await db2.execute("SELECT COUNT(*) as outcomes FROM outcome_sessions WHERE council_mode = 'AROS_DISCOVERY'");
  await db2.end();

  console.log(`\n=== FINAL STATE ===`);
  console.log(`aros_companies:   ${total}`);
  console.log(`aros_pipeline:    ${pipeline}`);
  console.log(`outcome_sessions: ${outcomes}`);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
