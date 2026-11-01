import { citizenshipLabel } from '@pms/domain';
import { intlLocale, type DeskLocale } from '../i18n';

/**
 * Название страны гражданства на языке человека (инструкция гостиницы 01.11.2026: в английской карточке брони было
 * «citizenship: Казахстан»). В базе ISO alpha-3, браузер и Node называют страну по alpha-2 (Intl.DisplayNames), поэтому
 * здесь пары alpha-3 → alpha-2 всех стран списка гражданства (iso-codes Debian). По-русски прежнее название из списка.
 */
const ALPHA2 = new Map(
  (
  'ABWAW AFGAF AGOAO AIAAI ALAAX ALBAL ANDAD AREAE ARGAR ARMAM ASMAS ATAAQ ATFTF ATGAG AUSAU AUTAT AZEAZ BDIBI ' +
  'BELBE BENBJ BESBQ BFABF BGDBD BGRBG BHRBH BHSBS BIHBA BLMBL BLRBY BLZBZ BMUBM BOLBO BRABR BRBBB BRNBN BTNBT ' +
  'BVTBV BWABW CAFCF CANCA CCKCC CHECH CHLCL CHNCN CIVCI CMRCM CODCD COGCG COKCK COLCO COMKM CPVCV CRICR CUBCU ' +
  'CUWCW CXRCX CYMKY CYPCY CZECZ DEUDE DJIDJ DMADM DNKDK DOMDO DZADZ ECUEC EGYEG ERIER ESHEH ESPES ESTEE ETHET ' +
  'FINFI FJIFJ FLKFK FRAFR FROFO FSMFM GABGA GBRGB GEOGE GGYGG GHAGH GIBGI GINGN GLPGP GMBGM GNBGW GNQGQ GRCGR ' +
  'GRDGD GRLGL GTMGT GUFGF GUMGU GUYGY HKGHK HMDHM HNDHN HRVHR HTIHT HUNHU IDNID IMNIM INDIN IOTIO IRLIE IRNIR ' +
  'IRQIQ ISLIS ISRIL ITAIT JAMJM JEYJE JORJO JPNJP KAZKZ KENKE KGZKG KHMKH KIRKI KNAKN KORKR KWTKW LAOLA LBNLB ' +
  'LBRLR LBYLY LCALC LIELI LKALK LSOLS LTULT LUXLU LVALV MACMO MAFMF MARMA MCOMC MDAMD MDGMG MDVMV MEXMX MHLMH ' +
  'MKDMK MLIML MLTMT MMRMM MNEME MNGMN MNPMP MOZMZ MRTMR MSRMS MTQMQ MUSMU MWIMW MYSMY MYTYT NAMNA NCLNC NERNE ' +
  'NFKNF NGANG NICNI NIUNU NLDNL NORNO NPLNP NRUNR NZLNZ OMNOM PAKPK PANPA PCNPN PERPE PHLPH PLWPW PNGPG POLPL ' +
  'PRIPR PRKKP PRTPT PRYPY PSEPS PYFPF QATQA REURE ROURO RUSRU RWARW SAUSA SDNSD SENSN SGPSG SGSGS SHNSH SJMSJ ' +
  'SLBSB SLESL SLVSV SMRSM SOMSO SPMPM SRBRS SSDSS STPST SURSR SVKSK SVNSI SWESE SWZSZ SXMSX SYCSC SYRSY TCATC ' +
  'TCDTD TGOTG THATH TJKTJ TKLTK TKMTM TLSTL TONTO TTOTT TUNTN TURTR TUVTV TWNTW TZATZ UGAUG UKRUA UMIUM URYUY ' +
  'USAUS UZBUZ VATVA VCTVC VENVE VGBVG VIRVI VNMVN VUTVU WLFWF WSMWS YEMYE ZAFZA ZMBZM ZWEZW '
  )
    .trim()
    .split(' ')
    .map((p) => [p.slice(0, 3), p.slice(3)] as const),
);
const names = new Map<string, Intl.DisplayNames>();

export function countryName(code: string | null | undefined, locale: DeskLocale): string | null {
  const c = (code ?? '').trim().toUpperCase();
  if (!c) return null;
  const a2 = ALPHA2.get(c);
  if (locale === 'ru' || !a2) return citizenshipLabel(c);
  let dn = names.get(locale);
  if (!dn) {
    dn = new Intl.DisplayNames([intlLocale(locale)], { type: 'region', fallback: 'none' });
    names.set(locale, dn);
  }
  return dn.of(a2) ?? citizenshipLabel(c);
}
