import type { LegalDocuments } from "./types";

const documents: LegalDocuments = {
  privacy: {
    effectiveDate: "1 de novembro de 2026",
    introduction:
      "Esta Política de Privacidade explica como as informações são tratadas quando você utiliza o NPC-DataConverter (o “Serviço”).",
    sections: [
      {
        title: "1. Processamento de dados",
        paragraphs: [
          "O NPC-DataConverter é uma ferramenta de conversão executada no lado do cliente, diretamente no navegador. Seus arquivos e dados de entrada não são enviados aos nossos servidores para realizar conversões.",
          "As conversões são processadas no seu próprio dispositivo. Não coletamos, armazenamos nem visualizamos os dados de entrada ou os resultados convertidos, a menos que você os compartilhe explicitamente.",
        ],
      },
      {
        title: "2. Informações do site e informações técnicas",
        paragraphs: [
          "Durante a hospedagem e a operação do site, o provedor de hospedagem poderá registrar automaticamente informações técnicas básicas, como endereço IP, tipo de navegador, informações do dispositivo e horário de acesso. Essas informações poderão ser utilizadas para disponibilizar o serviço, garantir a segurança e solucionar problemas.",
        ],
      },
      {
        title: "3. Cookies e armazenamento local",
        paragraphs: [
          "O Serviço poderá utilizar tecnologias como o armazenamento local do navegador para oferecer funcionalidades básicas e manter as preferências do usuário. Esses dados ficam armazenados no seu dispositivo e podem ser removidos nas configurações do navegador.",
        ],
      },
      {
        title: "4. Serviços de terceiros",
        paragraphs: [
          "Este site poderá utilizar serviços de terceiros para hospedagem, distribuição de conteúdo e segurança. Esses provedores poderão processar informações técnicas de acordo com suas próprias políticas de privacidade.",
        ],
      },
      {
        title: "5. Retenção e segurança dos dados",
        paragraphs: [
          "O Serviço não armazena em nossos servidores os arquivos que você deseja converter nem o conteúdo desses arquivos. Os dados temporários gerados no navegador são gerenciados de acordo com o funcionamento do navegador e as ações do usuário.",
          "Adotamos medidas razoáveis para manter a segurança e a confiabilidade do Serviço. No entanto, não é possível garantir a segurança absoluta das transmissões pela Internet ou dos métodos de armazenamento eletrônico.",
        ],
      },
      {
        title: "6. Privacidade de crianças",
        paragraphs: [
          "O Serviço não é destinado a crianças menores de 13 anos. Não coletamos intencionalmente informações pessoais de crianças menores de 13 anos.",
        ],
      },
      {
        title: "7. Atualizações desta política",
        paragraphs: [
          "Esta Política de Privacidade poderá ser atualizada em decorrência de alterações no Serviço ou em nossas operações. As mudanças serão publicadas nesta página, juntamente com a data da revisão.",
        ],
      },
    ],
    footerPrefix: "Para obter informações sobre o projeto, visite o ",
    linkLabel: "perfil do GitHub do responsável pelo projeto",
    footerSuffix: ".",
  },
  terms: {
    effectiveDate: "1 de novembro de 2026",
    introduction:
      "Leia estes Termos de Serviço antes de utilizar o NPC-DataConverter. Ao acessar ou utilizar o Serviço, você concorda com estes termos.",
    sections: [
      {
        title: "1. Descrição do serviço",
        paragraphs: [
          "O NPC-DataConverter é uma ferramenta que converte diferentes formatos de arquivo diretamente no navegador. O Serviço é fornecido no estado em que se encontra, e suas funcionalidades ou formatos compatíveis poderão ser alterados sem aviso prévio.",
        ],
      },
      {
        title: "2. Uso aceitável",
        paragraphs: [
          "Você deve utilizar o Serviço em conformidade com as leis aplicáveis. Não é permitido utilizá-lo para interromper seu funcionamento, tentar obter acesso não autorizado, distribuir códigos maliciosos ou violar os direitos de terceiros.",
        ],
      },
      {
        title: "3. Seus dados e responsabilidades",
        paragraphs: [
          "Você é responsável pelos dados de entrada, pelos resultados das conversões e pelo uso que faz dessas informações. Faça cópias de segurança dos dados importantes antes de realizar qualquer conversão.",
          "Não garantimos a precisão, a integridade ou a adequação dos resultados de conversão a uma finalidade específica. Verifique sempre os resultados antes de utilizá-los em situações importantes.",
        ],
      },
      {
        title: "4. Ausência de aconselhamento profissional",
        paragraphs: [
          "As informações e os resultados fornecidos pelo Serviço não constituem aconselhamento jurídico, financeiro, médico ou de qualquer outra natureza profissional. Consulte um profissional qualificado quando necessário.",
        ],
      },
      {
        title: "5. Propriedade intelectual",
        paragraphs: [
          "Os direitos relativos ao software, ao design, aos elementos da marca e ao conteúdo relacionado ao Serviço estão sujeitos às licenças aplicáveis ou às condições expressamente indicadas. Os direitos sobre os dados fornecidos pelo usuário permanecem com o próprio usuário.",
        ],
      },
      {
        title: "6. Disponibilidade e alterações",
        paragraphs: [
          "Empenhamo-nos em manter o Serviço disponível, mas não garantimos acesso ininterrupto. Podemos modificar funcionalidades, suspender ou encerrar o Serviço a qualquer momento.",
        ],
      },
      {
        title: "7. Isenção de garantias",
        paragraphs: [
          "Na máxima extensão permitida pela legislação aplicável, o Serviço é fornecido “no estado em que se encontra” e “conforme disponível”, sem garantias de qualquer tipo, expressas ou implícitas.",
        ],
      },
      {
        title: "8. Limitação de responsabilidade",
        paragraphs: [
          "Na máxima extensão permitida pela legislação aplicável, o responsável pelo Serviço não será responsável por danos diretos, indiretos, incidentais, especiais ou consequenciais, perda de dados ou perda de lucros decorrentes do uso ou da impossibilidade de uso do Serviço.",
        ],
      },
      {
        title: "9. Alterações destes termos",
        paragraphs: [
          "Estes Termos de Serviço poderão ser atualizados periodicamente. Os termos revisados entrarão em vigor quando forem publicados nesta página. O uso continuado do Serviço após a publicação das alterações representa sua concordância com os termos atualizados.",
        ],
      },
    ],
    footerPrefix: "Este projeto é mantido de forma independente. Para obter informações, visite ",
    linkLabel: "GitHub.com/newddf",
    footerSuffix: ".",
  },
};

export default documents;
