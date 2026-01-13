// Hunter.io API integration for finding decision makers
// Docs: https://hunter.io/api-documentation

interface HunterEmail {
  value: string;
  type: string;
  confidence: number;
  first_name: string | null;
  last_name: string | null;
  position: string | null;
  seniority: string | null;
  department: string | null;
  linkedin: string | null;
  twitter: string | null;
  phone_number: string | null;
}

interface HunterDomainSearchResponse {
  data: {
    domain: string;
    disposable: boolean;
    webmail: boolean;
    accept_all: boolean;
    pattern: string | null;
    organization: string | null;
    emails: HunterEmail[];
  };
  meta: {
    results: number;
    limit: number;
    offset: number;
  };
}

export interface DecisionMaker {
  email: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  position: string | null;
  seniority: string | null;
  department: string | null;
  confidence: number;
  linkedin: string | null;
  phone: string | null;
}

// Extraer dominio de una URL
function extractDomain(url: string): string | null {
  try {
    const parsed = new URL(url);
    // Remover www. si existe
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

// Filtrar por seniority relevante para ventas B2B
const RELEVANT_SENIORITIES = ['executive', 'senior', 'manager', 'director', 'owner'];
const RELEVANT_DEPARTMENTS = ['executive', 'management', 'operations', 'purchasing', 'finance'];

export async function findDecisionMakers(websiteUrl: string): Promise<DecisionMaker[]> {
  const apiKey = process.env.HUNTER_API_KEY;

  if (!apiKey) {
    console.warn('HUNTER_API_KEY not configured');
    return [];
  }

  const domain = extractDomain(websiteUrl);
  if (!domain) {
    console.warn('Could not extract domain from:', websiteUrl);
    return [];
  }

  try {
    const response = await fetch(
      `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${apiKey}&limit=10`,
      {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('Hunter.io API error:', response.status, error);
      return [];
    }

    const result: HunterDomainSearchResponse = await response.json();

    if (!result.data?.emails?.length) {
      return [];
    }

    // Filtrar y mapear emails relevantes
    const decisionMakers: DecisionMaker[] = result.data.emails
      .filter(email => {
        // Priorizar personas con seniority o departamento relevante
        const hasRelevantSeniority = email.seniority &&
          RELEVANT_SENIORITIES.includes(email.seniority.toLowerCase());
        const hasRelevantDepartment = email.department &&
          RELEVANT_DEPARTMENTS.includes(email.department.toLowerCase());
        const hasHighConfidence = email.confidence >= 70;

        // Incluir si tiene cargo ejecutivo O alta confianza
        return hasRelevantSeniority || hasRelevantDepartment || hasHighConfidence;
      })
      .map(email => ({
        email: email.value,
        firstName: email.first_name,
        lastName: email.last_name,
        fullName: email.first_name && email.last_name
          ? `${email.first_name} ${email.last_name}`
          : null,
        position: email.position,
        seniority: email.seniority,
        department: email.department,
        confidence: email.confidence,
        linkedin: email.linkedin,
        phone: email.phone_number,
      }))
      // Ordenar por seniority y confianza
      .sort((a, b) => {
        // Priorizar ejecutivos
        const aIsExec = a.seniority === 'executive' || a.position?.toLowerCase().includes('gerente') || a.position?.toLowerCase().includes('director');
        const bIsExec = b.seniority === 'executive' || b.position?.toLowerCase().includes('gerente') || b.position?.toLowerCase().includes('director');
        if (aIsExec && !bIsExec) return -1;
        if (!aIsExec && bIsExec) return 1;
        // Luego por confianza
        return b.confidence - a.confidence;
      })
      .slice(0, 3); // Máximo 3 decision makers por empresa

    return decisionMakers;
  } catch (error) {
    console.error('Error fetching from Hunter.io:', error);
    return [];
  }
}

// Verificar cuántos créditos quedan
export async function getHunterCredits(): Promise<{ used: number; available: number } | null> {
  const apiKey = process.env.HUNTER_API_KEY;

  if (!apiKey) {
    return null;
  }

  try {
    const response = await fetch(
      `https://api.hunter.io/v2/account?api_key=${apiKey}`,
      { method: 'GET' }
    );

    if (!response.ok) {
      return null;
    }

    const result = await response.json();
    return {
      used: result.data?.requests?.searches?.used || 0,
      available: result.data?.requests?.searches?.available || 0,
    };
  } catch {
    return null;
  }
}
