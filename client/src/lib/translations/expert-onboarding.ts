export type Language = "pt" | "es" | "en";

export interface TranslationStrings {
  pageTitle: string;
  pageSubtitle: string;
  projectInfoTitle: string;
  projectDescription: string;
  vettingQuestionsTitle: string;
  vettingQuestionsDescription: string;
  
  loginInfoTitle: string;
  email: string;
  emailPlaceholder: string;
  password: string;
  passwordPlaceholder: string;
  confirmPassword: string;
  confirmPasswordPlaceholder: string;
  passwordMinLength: string;
  passwordsDoNotMatch: string;
  
  basicInfoTitle: string;
  firstName: string;
  firstNamePlaceholder: string;
  lastName: string;
  lastNamePlaceholder: string;
  country: string;
  countryPlaceholder: string;
  region: string;
  regionPlaceholder: string;
  phone: string;
  countryCode: string;
  countryCodePlaceholder: string;
  phoneNumber: string;
  phoneNumberPlaceholder: string;
  linkedinUrl: string;
  linkedinUrlPlaceholder: string;
  city: string;
  cityPlaceholder: string;
  canConsultInEnglish: string;
  yes: string;
  no: string;
  timezone: string;
  timezonePlaceholder: string;
  
  experienceTitle: string;
  addExperience: string;
  company: string;
  companyPlaceholder: string;
  titleRole: string;
  titleRolePlaceholder: string;
  fromDate: string;
  toDate: string;
  currentPosition: string;
  month: string;
  year: string;
  removeExperience: string;
  
  biographyTitle: string;
  biographyPlaceholder: string;
  biographyDescription: string;
  
  workHistoryTitle: string;
  workHistoryPlaceholder: string;
  workHistoryDescription: string;
  
  hourlyRateTitle: string;
  hourlyRate: string;
  hourlyRatePlaceholder: string;
  currency: string;
  currencyPlaceholder: string;
  
  termsTitle: string;
  termsCheckboxLabel: string;
  termsLink: string;
  privacyLink: string;
  termsRequired: string;
  lgpdCheckboxLabel: string;
  lgpdLink: string;
  lgpdRequired: string;
  
  submitButton: string;
  submitting: string;
  
  successTitle: string;
  successMessage: string;
  closeButton: string;
  
  errorTitle: string;
  invalidLink: string;
  expiredLink: string;
  usedLink: string;
  
  loading: string;
  required: string;
  invalidEmail: string;
  invalidUrl: string;
  
  languageLabel: string;
  
  registerExpertModalTitle: string;
  registerExpertModalSubtitle: string;
  registerExpertButton: string;
  inviteLinkCreated: string;
  inviteLinkCopied: string;
  copyLink: string;
  expertRegistered: string;
}

export const translations: Record<Language, TranslationStrings> = {
  pt: {
    pageTitle: "Cadastro de Especialista",
    pageSubtitle: "Preencha o formulário abaixo para se cadastrar como especialista na Mirae Connext.",
    projectInfoTitle: "Informações do Projeto",
    projectDescription: "Você foi convidado para participar deste projeto.",
    vettingQuestionsTitle: "Perguntas de Triagem do Projeto",
    vettingQuestionsDescription: "Por favor, responda às perguntas abaixo para demonstrar sua experiência.",
    
    loginInfoTitle: "Informações de Login",
    email: "E-mail",
    emailPlaceholder: "seu.email@exemplo.com",
    password: "Senha",
    passwordPlaceholder: "Mínimo 8 caracteres",
    confirmPassword: "Confirmar Senha",
    confirmPasswordPlaceholder: "Digite a senha novamente",
    passwordMinLength: "A senha deve ter pelo menos 8 caracteres",
    passwordsDoNotMatch: "As senhas não coincidem",
    
    basicInfoTitle: "Informações Básicas",
    firstName: "Nome",
    firstNamePlaceholder: "Seu nome",
    lastName: "Sobrenome",
    lastNamePlaceholder: "Seu sobrenome",
    country: "País",
    countryPlaceholder: "Selecione o país",
    region: "Estado/Região",
    regionPlaceholder: "Seu estado ou região",
    phone: "Telefone",
    countryCode: "Código do País",
    countryCodePlaceholder: "+55",
    phoneNumber: "Número de Telefone",
    phoneNumberPlaceholder: "11 99999-9999",
    linkedinUrl: "URL do LinkedIn",
    linkedinUrlPlaceholder: "https://linkedin.com/in/seu-perfil",
    city: "Cidade",
    cityPlaceholder: "Sua cidade",
    canConsultInEnglish: "Você pode realizar consultorias em inglês?",
    yes: "Sim",
    no: "Não",
    timezone: "Fuso Horário",
    timezonePlaceholder: "Selecione o fuso horário",
    
    experienceTitle: "Experiência Profissional",
    addExperience: "Adicionar Experiência",
    company: "Empresa",
    companyPlaceholder: "Nome da empresa",
    titleRole: "Cargo",
    titleRolePlaceholder: "Seu cargo/função",
    fromDate: "De",
    toDate: "Até",
    currentPosition: "Cargo Atual",
    month: "Mês",
    year: "Ano",
    removeExperience: "Remover",
    
    biographyTitle: "Biografia",
    biographyPlaceholder: "Descreva sua experiência profissional, conquistas e áreas de especialização...",
    biographyDescription: "Uma breve descrição do seu perfil profissional.",
    
    workHistoryTitle: "Histórico de Trabalho",
    workHistoryPlaceholder: "Descreva seu histórico profissional, principais projetos, responsabilidades e conquistas...",
    workHistoryDescription: "Um resumo detalhado do seu histórico de trabalho e experiências relevantes.",
    
    hourlyRateTitle: "Taxa por Hora",
    hourlyRate: "Valor por Hora",
    hourlyRatePlaceholder: "Ex: 250",
    currency: "Moeda",
    currencyPlaceholder: "Selecione a moeda",
    
    termsTitle: "Termos e Condições",
    termsCheckboxLabel: "Ao marcar esta caixa, declaro que concordo com os",
    termsLink: "Termos e Condições",
    privacyLink: "Política de Privacidade",
    termsRequired: "Você deve aceitar os termos para continuar",
    lgpdCheckboxLabel: "Concordo com a",
    lgpdLink: "Política LGPD",
    lgpdRequired: "Você deve aceitar a política LGPD para continuar",
    
    submitButton: "Enviar Cadastro",
    submitting: "Enviando...",
    
    successTitle: "Obrigado!",
    successMessage: "Seu perfil e respostas foram enviados. A equipe da Mirae Connext entrará em contato se o seu perfil corresponder aos requisitos do projeto.",
    closeButton: "Fechar",
    
    errorTitle: "Erro",
    invalidLink: "Este link de convite é inválido.",
    expiredLink: "Este link de convite expirou.",
    usedLink: "Este link de convite já foi utilizado.",
    
    loading: "Carregando...",
    required: "Campo obrigatório",
    invalidEmail: "E-mail inválido",
    invalidUrl: "URL inválida",
    
    languageLabel: "Idioma",
    
    registerExpertModalTitle: "Cadastrar Novo Especialista",
    registerExpertModalSubtitle: "Preencha os dados do especialista para cadastrá-lo no projeto.",
    registerExpertButton: "Cadastrar Especialista",
    inviteLinkCreated: "Link de convite criado!",
    inviteLinkCopied: "Link copiado para a área de transferência",
    copyLink: "Copiar Link",
    expertRegistered: "Especialista cadastrado com sucesso!",
  },
  es: {
    pageTitle: "Registro de Experto",
    pageSubtitle: "Complete el formulario a continuación para registrarse como experto en Mirae Connext.",
    projectInfoTitle: "Información del Proyecto",
    projectDescription: "Ha sido invitado a participar en este proyecto.",
    vettingQuestionsTitle: "Preguntas de Evaluación del Proyecto",
    vettingQuestionsDescription: "Por favor, responda las siguientes preguntas para demostrar su experiencia.",
    
    loginInfoTitle: "Información de Inicio de Sesión",
    email: "Correo Electrónico",
    emailPlaceholder: "su.email@ejemplo.com",
    password: "Contraseña",
    passwordPlaceholder: "Mínimo 8 caracteres",
    confirmPassword: "Confirmar Contraseña",
    confirmPasswordPlaceholder: "Ingrese la contraseña nuevamente",
    passwordMinLength: "La contraseña debe tener al menos 8 caracteres",
    passwordsDoNotMatch: "Las contraseñas no coinciden",
    
    basicInfoTitle: "Información Básica",
    firstName: "Nombre",
    firstNamePlaceholder: "Su nombre",
    lastName: "Apellido",
    lastNamePlaceholder: "Su apellido",
    country: "País",
    countryPlaceholder: "Seleccione el país",
    region: "Estado/Región",
    regionPlaceholder: "Su estado o región",
    phone: "Teléfono",
    countryCode: "Código de País",
    countryCodePlaceholder: "+54",
    phoneNumber: "Número de Teléfono",
    phoneNumberPlaceholder: "11 9999-9999",
    linkedinUrl: "URL de LinkedIn",
    linkedinUrlPlaceholder: "https://linkedin.com/in/su-perfil",
    city: "Ciudad",
    cityPlaceholder: "Su ciudad",
    canConsultInEnglish: "¿Puede realizar consultorías en inglés?",
    yes: "Sí",
    no: "No",
    timezone: "Zona Horaria",
    timezonePlaceholder: "Seleccione la zona horaria",
    
    experienceTitle: "Experiencia Profesional",
    addExperience: "Agregar Experiencia",
    company: "Empresa",
    companyPlaceholder: "Nombre de la empresa",
    titleRole: "Cargo",
    titleRolePlaceholder: "Su cargo/función",
    fromDate: "Desde",
    toDate: "Hasta",
    currentPosition: "Cargo Actual",
    month: "Mes",
    year: "Año",
    removeExperience: "Eliminar",
    
    biographyTitle: "Biografía",
    biographyPlaceholder: "Describa su experiencia profesional, logros y áreas de especialización...",
    biographyDescription: "Una breve descripción de su perfil profesional.",
    
    workHistoryTitle: "Historial Laboral",
    workHistoryPlaceholder: "Describa su historial laboral, proyectos principales, responsabilidades y logros...",
    workHistoryDescription: "Un resumen detallado de su historial laboral y experiencias relevantes.",
    
    hourlyRateTitle: "Tarifa por Hora",
    hourlyRate: "Valor por Hora",
    hourlyRatePlaceholder: "Ej: 250",
    currency: "Moneda",
    currencyPlaceholder: "Seleccione la moneda",
    
    termsTitle: "Términos y Condiciones",
    termsCheckboxLabel: "Al marcar esta casilla, declaro que acepto los",
    termsLink: "Términos y Condiciones",
    privacyLink: "Política de Privacidad",
    termsRequired: "Debe aceptar los términos para continuar",
    lgpdCheckboxLabel: "Acepto la",
    lgpdLink: "Política LGPD",
    lgpdRequired: "Debe aceptar la política LGPD para continuar",
    
    submitButton: "Enviar Registro",
    submitting: "Enviando...",
    
    successTitle: "¡Gracias!",
    successMessage: "Su perfil y respuestas han sido enviados. El equipo de Mirae Connext se comunicará con usted si su perfil coincide con los requisitos del proyecto.",
    closeButton: "Cerrar",
    
    errorTitle: "Error",
    invalidLink: "Este enlace de invitación no es válido.",
    expiredLink: "Este enlace de invitación ha expirado.",
    usedLink: "Este enlace de invitación ya ha sido utilizado.",
    
    loading: "Cargando...",
    required: "Campo obligatorio",
    invalidEmail: "Correo electrónico inválido",
    invalidUrl: "URL inválida",
    
    languageLabel: "Idioma",
    
    registerExpertModalTitle: "Registrar Nuevo Experto",
    registerExpertModalSubtitle: "Complete los datos del experto para registrarlo en el proyecto.",
    registerExpertButton: "Registrar Experto",
    inviteLinkCreated: "¡Enlace de invitación creado!",
    inviteLinkCopied: "Enlace copiado al portapapeles",
    copyLink: "Copiar Enlace",
    expertRegistered: "¡Experto registrado con éxito!",
  },
  en: {
    pageTitle: "Expert Registration",
    pageSubtitle: "Fill out the form below to register as an expert with Mirae Connext.",
    projectInfoTitle: "Project Information",
    projectDescription: "You have been invited to participate in this project.",
    vettingQuestionsTitle: "Project Vetting Questions",
    vettingQuestionsDescription: "Please answer the questions below to demonstrate your expertise.",
    
    loginInfoTitle: "Login Information",
    email: "Email",
    emailPlaceholder: "your.email@example.com",
    password: "Password",
    passwordPlaceholder: "Minimum 8 characters",
    confirmPassword: "Confirm Password",
    confirmPasswordPlaceholder: "Re-enter your password",
    passwordMinLength: "Password must be at least 8 characters",
    passwordsDoNotMatch: "Passwords do not match",
    
    basicInfoTitle: "Basic Information",
    firstName: "First Name",
    firstNamePlaceholder: "Your first name",
    lastName: "Last Name",
    lastNamePlaceholder: "Your last name",
    country: "Country",
    countryPlaceholder: "Select country",
    region: "State/Region",
    regionPlaceholder: "Your state or region",
    phone: "Phone",
    countryCode: "Country Code",
    countryCodePlaceholder: "+1",
    phoneNumber: "Phone Number",
    phoneNumberPlaceholder: "555 123 4567",
    linkedinUrl: "LinkedIn URL",
    linkedinUrlPlaceholder: "https://linkedin.com/in/your-profile",
    city: "City",
    cityPlaceholder: "Your city",
    canConsultInEnglish: "Can you consult in English?",
    yes: "Yes",
    no: "No",
    timezone: "Time Zone",
    timezonePlaceholder: "Select time zone",
    
    experienceTitle: "Professional Experience",
    addExperience: "Add Experience",
    company: "Company",
    companyPlaceholder: "Company name",
    titleRole: "Title/Role",
    titleRolePlaceholder: "Your job title",
    fromDate: "From",
    toDate: "To",
    currentPosition: "Current Position",
    month: "Month",
    year: "Year",
    removeExperience: "Remove",
    
    biographyTitle: "Biography",
    biographyPlaceholder: "Describe your professional background, achievements, and areas of expertise...",
    biographyDescription: "A brief description of your professional profile.",
    
    workHistoryTitle: "Work History",
    workHistoryPlaceholder: "Describe your work history, key projects, responsibilities, and achievements...",
    workHistoryDescription: "A detailed summary of your work history and relevant experiences.",
    
    hourlyRateTitle: "Hourly Rate",
    hourlyRate: "Hourly Rate",
    hourlyRatePlaceholder: "e.g., 250",
    currency: "Currency",
    currencyPlaceholder: "Select currency",
    
    termsTitle: "Terms & Conditions",
    termsCheckboxLabel: "By checking this box, I acknowledge that I agree to the",
    termsLink: "Terms and Conditions",
    privacyLink: "Privacy Policy",
    termsRequired: "You must accept the terms to continue",
    lgpdCheckboxLabel: "I agree to the",
    lgpdLink: "LGPD Policy",
    lgpdRequired: "You must accept the LGPD policy to continue",
    
    submitButton: "Submit Registration",
    submitting: "Submitting...",
    
    successTitle: "Thank You!",
    successMessage: "Your profile and answers have been submitted. The Mirae Connext team will reach out to you if your profile matches the project requirements.",
    closeButton: "Close",
    
    errorTitle: "Error",
    invalidLink: "This invitation link is invalid.",
    expiredLink: "This invitation link has expired.",
    usedLink: "This invitation link has already been used.",
    
    loading: "Loading...",
    required: "Required field",
    invalidEmail: "Invalid email",
    invalidUrl: "Invalid URL",
    
    languageLabel: "Language",
    
    registerExpertModalTitle: "Register New Expert",
    registerExpertModalSubtitle: "Fill in the expert details to register them for the project.",
    registerExpertButton: "Register Expert",
    inviteLinkCreated: "Invitation link created!",
    inviteLinkCopied: "Link copied to clipboard",
    copyLink: "Copy Link",
    expertRegistered: "Expert registered successfully!",
  },
};

export function detectBrowserLanguage(): Language {
  if (typeof navigator === "undefined") return "en";
  
  const browserLang = navigator.language.toLowerCase();
  
  if (browserLang.startsWith("pt")) return "pt";
  if (browserLang.startsWith("es")) return "es";
  return "en";
}

export const countries = [
  { code: "BR", name: { pt: "Brasil", es: "Brasil", en: "Brazil" } },
  { code: "AR", name: { pt: "Argentina", es: "Argentina", en: "Argentina" } },
  { code: "CL", name: { pt: "Chile", es: "Chile", en: "Chile" } },
  { code: "CO", name: { pt: "Colômbia", es: "Colombia", en: "Colombia" } },
  { code: "MX", name: { pt: "México", es: "México", en: "Mexico" } },
  { code: "PE", name: { pt: "Peru", es: "Perú", en: "Peru" } },
  { code: "US", name: { pt: "Estados Unidos", es: "Estados Unidos", en: "United States" } },
  { code: "CA", name: { pt: "Canadá", es: "Canadá", en: "Canada" } },
  { code: "GB", name: { pt: "Reino Unido", es: "Reino Unido", en: "United Kingdom" } },
  { code: "DE", name: { pt: "Alemanha", es: "Alemania", en: "Germany" } },
  { code: "FR", name: { pt: "França", es: "Francia", en: "France" } },
  { code: "ES", name: { pt: "Espanha", es: "España", en: "Spain" } },
  { code: "PT", name: { pt: "Portugal", es: "Portugal", en: "Portugal" } },
  { code: "IT", name: { pt: "Itália", es: "Italia", en: "Italy" } },
  { code: "JP", name: { pt: "Japão", es: "Japón", en: "Japan" } },
  { code: "CN", name: { pt: "China", es: "China", en: "China" } },
  { code: "IN", name: { pt: "Índia", es: "India", en: "India" } },
  { code: "AU", name: { pt: "Austrália", es: "Australia", en: "Australia" } },
  { code: "ZA", name: { pt: "África do Sul", es: "Sudáfrica", en: "South Africa" } },
  { code: "OTHER", name: { pt: "Outro", es: "Otro", en: "Other" } },
];

export const countryCodes = [
  { code: "+1", country: "US/CA" },
  { code: "+44", country: "UK" },
  { code: "+49", country: "DE" },
  { code: "+33", country: "FR" },
  { code: "+34", country: "ES" },
  { code: "+351", country: "PT" },
  { code: "+55", country: "BR" },
  { code: "+54", country: "AR" },
  { code: "+56", country: "CL" },
  { code: "+57", country: "CO" },
  { code: "+52", country: "MX" },
  { code: "+51", country: "PE" },
  { code: "+81", country: "JP" },
  { code: "+86", country: "CN" },
  { code: "+91", country: "IN" },
  { code: "+61", country: "AU" },
  { code: "+27", country: "ZA" },
];

export const timezones = [
  { value: "America/Sao_Paulo", label: { pt: "São Paulo (UTC-3)", es: "São Paulo (UTC-3)", en: "São Paulo (UTC-3)" } },
  { value: "America/Buenos_Aires", label: { pt: "Buenos Aires (UTC-3)", es: "Buenos Aires (UTC-3)", en: "Buenos Aires (UTC-3)" } },
  { value: "America/Santiago", label: { pt: "Santiago (UTC-4)", es: "Santiago (UTC-4)", en: "Santiago (UTC-4)" } },
  { value: "America/Bogota", label: { pt: "Bogotá (UTC-5)", es: "Bogotá (UTC-5)", en: "Bogota (UTC-5)" } },
  { value: "America/Mexico_City", label: { pt: "Cidade do México (UTC-6)", es: "Ciudad de México (UTC-6)", en: "Mexico City (UTC-6)" } },
  { value: "America/Lima", label: { pt: "Lima (UTC-5)", es: "Lima (UTC-5)", en: "Lima (UTC-5)" } },
  { value: "America/New_York", label: { pt: "Nova York (UTC-5)", es: "Nueva York (UTC-5)", en: "New York (UTC-5)" } },
  { value: "America/Chicago", label: { pt: "Chicago (UTC-6)", es: "Chicago (UTC-6)", en: "Chicago (UTC-6)" } },
  { value: "America/Denver", label: { pt: "Denver (UTC-7)", es: "Denver (UTC-7)", en: "Denver (UTC-7)" } },
  { value: "America/Los_Angeles", label: { pt: "Los Angeles (UTC-8)", es: "Los Angeles (UTC-8)", en: "Los Angeles (UTC-8)" } },
  { value: "Europe/London", label: { pt: "Londres (UTC+0)", es: "Londres (UTC+0)", en: "London (UTC+0)" } },
  { value: "Europe/Paris", label: { pt: "Paris (UTC+1)", es: "París (UTC+1)", en: "Paris (UTC+1)" } },
  { value: "Europe/Berlin", label: { pt: "Berlim (UTC+1)", es: "Berlín (UTC+1)", en: "Berlin (UTC+1)" } },
  { value: "Europe/Madrid", label: { pt: "Madri (UTC+1)", es: "Madrid (UTC+1)", en: "Madrid (UTC+1)" } },
  { value: "Europe/Lisbon", label: { pt: "Lisboa (UTC+0)", es: "Lisboa (UTC+0)", en: "Lisbon (UTC+0)" } },
  { value: "Asia/Tokyo", label: { pt: "Tóquio (UTC+9)", es: "Tokio (UTC+9)", en: "Tokyo (UTC+9)" } },
  { value: "Asia/Shanghai", label: { pt: "Xangai (UTC+8)", es: "Shanghái (UTC+8)", en: "Shanghai (UTC+8)" } },
  { value: "Asia/Kolkata", label: { pt: "Calcutá (UTC+5:30)", es: "Calcuta (UTC+5:30)", en: "Kolkata (UTC+5:30)" } },
  { value: "Australia/Sydney", label: { pt: "Sydney (UTC+11)", es: "Sídney (UTC+11)", en: "Sydney (UTC+11)" } },
  { value: "Africa/Johannesburg", label: { pt: "Joanesburgo (UTC+2)", es: "Johannesburgo (UTC+2)", en: "Johannesburg (UTC+2)" } },
];

export const currencies = [
  { code: "USD", symbol: "$", name: { pt: "Dólar Americano", es: "Dólar Estadounidense", en: "US Dollar" } },
  { code: "BRL", symbol: "R$", name: { pt: "Real Brasileiro", es: "Real Brasileño", en: "Brazilian Real" } },
  { code: "EUR", symbol: "€", name: { pt: "Euro", es: "Euro", en: "Euro" } },
  { code: "GBP", symbol: "£", name: { pt: "Libra Esterlina", es: "Libra Esterlina", en: "British Pound" } },
  { code: "ARS", symbol: "$", name: { pt: "Peso Argentino", es: "Peso Argentino", en: "Argentine Peso" } },
  { code: "CLP", symbol: "$", name: { pt: "Peso Chileno", es: "Peso Chileno", en: "Chilean Peso" } },
  { code: "COP", symbol: "$", name: { pt: "Peso Colombiano", es: "Peso Colombiano", en: "Colombian Peso" } },
  { code: "MXN", symbol: "$", name: { pt: "Peso Mexicano", es: "Peso Mexicano", en: "Mexican Peso" } },
];

export const months = [
  { value: "01", name: { pt: "Janeiro", es: "Enero", en: "January" } },
  { value: "02", name: { pt: "Fevereiro", es: "Febrero", en: "February" } },
  { value: "03", name: { pt: "Março", es: "Marzo", en: "March" } },
  { value: "04", name: { pt: "Abril", es: "Abril", en: "April" } },
  { value: "05", name: { pt: "Maio", es: "Mayo", en: "May" } },
  { value: "06", name: { pt: "Junho", es: "Junio", en: "June" } },
  { value: "07", name: { pt: "Julho", es: "Julio", en: "July" } },
  { value: "08", name: { pt: "Agosto", es: "Agosto", en: "August" } },
  { value: "09", name: { pt: "Setembro", es: "Septiembre", en: "September" } },
  { value: "10", name: { pt: "Outubro", es: "Octubre", en: "October" } },
  { value: "11", name: { pt: "Novembro", es: "Noviembre", en: "November" } },
  { value: "12", name: { pt: "Dezembro", es: "Diciembre", en: "December" } },
];

export function getYearOptions(): string[] {
  const currentYear = new Date().getFullYear();
  const years: string[] = [];
  for (let year = currentYear; year >= currentYear - 50; year--) {
    years.push(year.toString());
  }
  return years;
}
