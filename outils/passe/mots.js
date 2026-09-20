/*!
 * Liste de mots français pour la génération de phrases de passe.
 *
 * Contraintes, toutes vérifiées par un test :
 * - lettres a-z uniquement, aucun accent — une phrase de passe doit pouvoir se
 *   taper sur n'importe quel clavier, y compris un clavier de téléphone en
 *   anglais ou le clavier d'un écran de démarrage ;
 * - 4 à 9 lettres — assez long pour ne pas se confondre, assez court pour se
 *   retaper sans faute ;
 * - aucun doublon — un doublon fausserait le calcul d'entropie à la baisse ;
 * - mots concrets et courants, faciles à se représenter mentalement.
 *
 * L'entropie par mot n'est JAMAIS écrite en dur : elle est calculée à partir
 * de la longueur réelle de cette liste. Ajouter ou retirer un mot met le
 * chiffre à jour tout seul.
 *
 * Cette liste sert deux fois : à fabriquer des phrases de passe, et à repérer
 * les mots du dictionnaire dans un mot de passe existant.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.PasseMots = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var BRUT = [
    'abeille agneau aigle amande ananas ancre anneau antenne appui arbre',
    'arcade archer ardoise argent armoire arome arrosoir asperge assiette atelier',
    'atlas aubaine auberge autobus automne autruche avalanche avenue averse avion',
    'bagage baguette baie balai balcon baleine balise ballon bambou banane',
    'banc bandeau banque barbe barque barrage bassin bateau baton bavoir',
    'beton biberon bibelot bidon bijou bilan bison biscuit biche blason',
    'bocal boisson boite bonbon bonnet bosquet botte bouchon boucle bouee',
    'bougie boulon bouquet bourse boussole bouton branche bras brebis bretelle',
    'brique brise brochet brosse brouette bruit brume buisson bulle bureau',
    'cabane cabine cable cachet cadeau cadran cafe cage cahier caillou',
    'caisse calcul calepin camion campagne canal canard canne canot canyon',
    'capot capsule caravane carbone carnet carotte carreau cartable carton cascade',
    'casque casserole castor cavalier caverne ceinture cendre cerceau cercle cerf',
    'cerise chaine chaise chalet chameau champ chandelle chanson chapeau charbon',
    'chariot charrue chasse chateau chaton chaudron chaussure chemin cheminee chemise',
    'chene cheval chevre chiffon chiffre chignon chocolat chorale chose chute',
    'cible cigare cidre ciel cigale cigogne cime cinema cintre circuit',
    'cirque ciseau citron clairon clameur clapet clavier clocher cloison cloture',
    'clou cobra cochon cocon coffre coiffure colis colle colline colombe',
    'colonne combat comete commande compas complot concert conduite confiture congre',
    'console contour copain coquille corbeau corde cordon corne cornet corsaire',
    'costume coton couloir coupe courant couronne courrier course coussin couteau',
    'couture couvercle crabe craie crampon crapaud cratere crayon creneau crevette',
    'crible criquet crochet crocus croisade croquis crotale cuiller cuisine cuivre',
    'culture cuve cyclone cygne cymbale dalle danse dauphin debut decor',
    'dessin destin detour diamant dictee digue dindon diplome disque dolmen',
    'domaine donjon dortoir dossier douane douche douzaine dragon drapeau duvet',
    'eclair ecluse ecole ecorce ecran ecrou ecurie edifice effort eglise',
    'elan elastique empreinte enclos encre enclume enigme entonnoir epaule epave',
    'epice epine eponge equerre erable escabeau escalier escargot espace essaim',
    'etable etage etang etendard etincelle etoile etude eventail evier examen',
    'exploit facade fagot faisan falaise famille fanfare fantome farine faucon',
    'fauteuil fenetre fente ferme festin feuille fiacre ficelle figue figurine',
    'filet filon flacon flamme flanc flaque fleche flocon flotte flute',
    'foire fontaine foret forge formule fossile foudre fougere foulard four',
    'fourche fourmi fourneau foyer fraise framboise frange frein fresque friandise',
    'frisson fromage front fruit fusee fusain gabarit gadget gaffe galet',
    'galerie galon gamelle gant garage garde gare gateau gazelle gazon',
    'geant gelee genou gerbe geyser gibier gilet girafe givre glacier',
    'gland globe gobelet golfe gomme gong gorge goutte grain graine',
    'grange granit grappe gravier grelot grenade grenier grillage grimace grotte',
    'groupe grue guepe guerre guichet guidon guirlande guitare habit hache',
    'haie hameau hamster hangar harpe hasard haut havre herbe herisson',
    'heron heure hibou hibiscus histoire hiver homard horizon horloge hotel',
    'houle hublot huile humeur hutte idee igloo image immeuble impasse',
    'indice insecte instant insigne iris ivoire jachere jambon jardin jasmin',
    'jauge javelot jeton jongleur jonquille joue journal joyau jument jungle',
    'jupon jury kayak kimono kiosque koala labour lacet lagune laine',
    'laiton lampe lance langue lanterne lapin larme lasso laurier lavande',
    'lecon legume lentille levier lezard liane libellule lierre ligne limace',
    'linge lion liqueur liseron liste litige livre local loquet loge',
    'loisir long loriot losange lotus loupe loutre lucarne lueur luge',
    'lumiere lune lustre luth lutin machine madrier magasin maillot main',
    'maison maitre malle mammouth manche mandarine manege manoir manteau marais',
    'marbre marche mare maree margelle marin marmite marteau masque massif',
    'matelas matin mazout meche medaille melodie melon menhir menu merle',
    'mesange mesure metal meteore metier meuble miel miette mine minerai',
    'minute miroir mistral mitaine mobile module moineau moisson moitie molaire',
    'moment monde monnaie montagne montre monture morceau mortier motif mouche',
    'mouette moufle moulin mousse mouton muguet mulot muraille museau musique',
    'myrtille nacelle nappe narine nature navet navire nectar nenuphar nervure',
    'niche nichoir noyer niveau noisette noix nombril nord notice nougat',
    'nouvelle noyau nuage nuance nuit numero ocean octave odeur oeillet',
    'oignon oiseau olive ombre omelette onde ongle opale orage orange',
    'orchidee oratoire oreille organe orgue orient orme ornement orteil otarie',
    'ouragan ours outil ouvrage ovale paille palais palette palier palmier',
    'panda panier panneau pantalon papier papillon paquet parapluie parasol parcelle',
    'parcours parfum parquet partage pastel patinoire patio patron paume pavillon',
    'peche pedale peigne peinture pelle pelouse pendule pente pepite perche',
    'perdrix perle perroquet persil phare phoque photo piano pierre pieuvre',
    'pigeon pilier pilote piment pince pinceau pingouin pioche pipeau piquet',
    'piscine piste pivert pivoine placard plafond plage plaine planche plante',
    'plateau plomb plongeon pluie plume poche poeme poignee poisson poivre',
    'polaire pomme pompe poney pont porche portail porte portrait poste',
    'potager poterie potiron poulain poule poulie poupee pourpre poussin poutre',
    'prairie presse prisme prison prunier pupitre puzzle pyjama pylone python',
    'quai quartier quartz quille quinzaine rabot racine radeau radis rafale',
    'rail raisin rame rameau rampe ranch rangee rapace rasoir ravin',
    'rayon record recif recolte refuge regard regime region registre reglage',
    'reine relief remise renard rendez renne repas repere reptile requin',
    'reseau ressort ressac retour reveil revue rhume rigueur rideau rigole',
    'rivage riviere rocher rondin ronce roseau rosee rotule roue rouille',
    'rouleau route ruban rubis ruche ruelle rugby ruine ruisseau rythme',
    'sabot sable sabre sachet sacoche safran saison salade salon sandale',
    'sanglier santal sapin sardine satin sauge saule saumon saphir savon',
    'scarabee sceau science scie sculpture seau secteur seigle sellette semaine',
    'semelle semence sentier serpent serre serrure service seuil signal silo',
    'sillon singe sirene sirop sirocco sofa soie soir soldat soleil',
    'sommet sonate sonnette sorbet sortie soucoupe souche souffle soupape soupe',
    'source souris spectacle sphere spirale sport square stade statue store',
    'sucre sureau surface symbole table tableau tabouret tache taille talon',
    'tambour tamis tapis taupe taureau tempete tenaille tente terrasse terre',
    'terrier tesson tete texte theatre theiere ticket tigre tilleul timbre',
    'tirelire tiroir tisane tissu titre toile toiture tomate tonneau torche',
    'torrent tortue touche toupie tour tourbe tournesol tracteur traineau trajet',
    'tramway tranche travail treize tremplin tresor tribu tricot trident trombone',
    'trompette tronc trophee tropique trottoir troupeau truelle truite tulipe tunnel',
    'turbine tuyau ukulele usine ustensile vague vaisseau vallee vanille vapeur',
    'varech vase veau velours velo vendange vent verger vernis verre',
    'verrou vertige veste viaduc victoire vigne village ville vinaigre violette',
    'violon vipere virage vitrail vitrine voile voilier voisin voiture volant',
    'volcan volet volume voute voyage vrille wagon xylophone yacht yaourt',
    'zebre zenith zeste zigzag zone zoom'
  ].join(' ').split(/\s+/);

  /* Filtre de sûreté. Il ne remplace pas le test : il garantit qu'un mot
     mal formé glissé dans la liste ne casse jamais le calcul d'entropie en
     silence — il disparaît, et le test le signale. */
  var MOTS = [];
  var vus = Object.create(null);
  for (var i = 0; i < BRUT.length; i++) {
    var m = BRUT[i];
    if (!/^[a-z]{4,9}$/.test(m)) continue;
    if (vus[m]) continue;
    vus[m] = true;
    MOTS.push(m);
  }
  MOTS.sort();

  return { MOTS: MOTS, BRUT: BRUT };
});
