const Discord = require('discord.js')
const clientDiscord = new Discord.Client();
const YTDL = require("ytdl-core");
const PREFIX = "!";

const defaults = {
	timeout: 30,
	color: 2555834,
	triggers: {newPoll: '!sondage', vote: '!vote', results: '!resultats'},
	appName: 'Beast-gang © Vote'
};

var pollIndex = 0, polls = new Map();

var dispatcher; 

// The corresponding emojis are used as unique keys for choices within each poll object
const emoji = {
	numbers: ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']
		.map((value, index) => [String(index), `:${value}:`]),
	letters: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z']
		.map(value => [value, `:regional_indicator_${value}:`]),
	yn: [['yes','**Yes**'],['no','**No**']],
	maybe: ['maybe','**Maybe**']
};

class Poll {
	constructor(opt) {
		var args = opt.arguments;
		this.name = opt.name;
		this.id = pollIndex;
			pollIndex++;

		this.choices = new Map();
		opt.choices.forEach((value, index) => {
			this.choices.set(emoji[opt.emojiType][index][0], {
				name: value,
				emoji: emoji[opt.emojiType][index][1],
				votes: 0
			});
		});
		if(args.maybe || args.idk) {
			this.choices.set(emoji.maybe[0], {
				name: 'I don\'t know.',
				emoji: emoji.maybe[1],
				votes: 0
			});
		}

		this.disallowEdits = args.lock || false;
		this.blind = args.blind || false;
		this.reactionVoting = args.reactions || args.rxn || false;
		this.allowMultipleVotes = this.reactionVoting || args.mult || args.multiple || false;
		this.restrictRole = args.role || false;
		this.dontCloseEarly = args.lo || args.leaveopen || args.dontcloseearly || false;
		this.timeout = opt.timeout || 30;
		this.color = opt.color;

		this.footNote = opt.notes || ' ';
		this.footNote += `${opt.notes ? '| ' : ''}Ce Sondage  #${this.id}. Va expiré dans ${this.timeout} minutes.`;

		this.open = false;
		this.totalVotes = 0;

		this.voters = new Map();

		this.server = opt.server;

		this.timeCreated = new Date();
	}

	// Function to initiate timer
	startTimer() {
		this.open = true;
		setTimeout(function() {
			this.open = false;
		}.bind(this), this.timeout * 60 * 1000);
	}

	// Log votes (if the poll is open and unlocked/user hasn't voted)
	vote(key, user) {
		console.log(key, this.choices);
		if(this.open) {
			if(this.lock && this.voters.get(user.id)) {
				return {
					success: false,
					reason: 'lock',
					message: "Désolé, il s'agit d'un sondage verrouillé (vous ne pouvez pas modifier votre vote) et vous avez déjà voté."
				};
			} else if(!this.choices.get(key)) {
				return {
					success: false,
					reason: 'invalid',
					message: "Cette option n'est pas un choix valide, je ne peux donc pas enregistrer votre vote. Essayez d’envoyer uniquement la lettre, le chiffre ou le mot correspondant au choix."
				};
			} else if(this.voters.get(user.id)) {
				// User has already voted, we need to change their vote
				let oldVoter = this.voters.get(user.id);
				this.choices.get(oldVoter.vote.choice).votes--;
				
				this.choices.get(key).votes++;
				this.voters.set(user.id, {
					user: user,
					vote: {
						time: new Date(),
						choice: key
					}
				});
				return {
					success: true,
					reason: '',
					message: `Super, j'ai changé votre vote en "${this.choices.get(key).name}"!`
				};

			} else {
				this.choices.get(key).votes++;
				// While we technically *could* use the user object as the key, that would be difficult to access. id should be unique.
				this.voters.set(user.id, {
					user: user,
					vote: {
						time: new Date(),
						choice: key
					}
				});
				return {
					success: true,
					reason: '',
					message: `Super, j'ai enregistré votre vote pour"${this.choices.get(key).name}"!`
				};
			}
		} else {
			return {
				sucess: false,
				reason: 'timeout',
				message: "Désolé, ce sondage a expiré et ne peut plus être voté."
			};
		}
	}

	close() {
		// Calling close() on a closed poll has no effect
		if(this.open) {
			this.open = false;
			return true;
		} else return false;
	}

	get chart() {
		// TODO generate charts of results
		return null;
	}
}

function generateDiscordEmbed(poll, type) {
	var embed = {}, choiceList = ``, resultsList = ``;
	poll.choices.forEach((choice, key) => {
		choiceList += `${choice.emoji} - ${choice.name} \n`;
		resultsList += `***${choice.votes} votes*** \n`;
	});

	switch(type) {
		case 'poll':
			embed = {
				title: `Sondage ${poll.id}: ${poll.name}`,
				description: ` Pour voter, répondez avec\`!vote choix\`. Il reste encore ${poll.timeout} minutes. Par exemple, "!vote ${poll.choices.keys().next().value}". Si plusieur sondage sont en cours, vous devrez spécifier lequel en utilisant son numéro et un # : \`!vote #${poll.id} choix\`.`,
				color: poll.color,
				timestamp: poll.timeCreated,
				footer: {
					text: poll.footNote
				},
				author: {
					name: defaults.appName
				},
				fields: [{
					name: `Choix:`,
					value: choiceList
				}]
			};
			break;
		case 'results':
			//TODO: Order choices in results based on number of votes

			embed = {
				title: `*Resultats* - Sondage ${poll.id}: ${poll.name}`,
				description: poll.open ? `Ce sondage est toujours ouvert, donc ces résultats peuvent changer.` : `Ce sondage est fermé et ne peut pas être voté.`,
				color: poll.color,
				timestamp: new Date(),
				footer: {
					text: `Pour des résultats plus détaillés, utilisez le \`--users\` flag.`
				},
				author: {
					name: defaults.appName
				},
				fields: [{
					name: `Choix:`,
					value: choiceList,
					inline: true
				}, {
					name: `Resultats:`,
					value: resultsList,
					inline: true
				}]
			};
			break;
		case 'detailResults':
			//TODO: Order choices in results based on number of votes

			embed = {
				title: `*Resultats* - Sondage ${poll.id}: ${poll.name}`,
				description: poll.open ? `Ce sondage est toujours ouvert, donc ces résultats peuvent changer.` : `Ce sondage est fermé et ne peut pas être voté.`,
				color: poll.color,
				timestamp: new Date(),
				footer: {
					text: `Nous n'avons pas encore de capacité de résultats détaillés.`
				},
				author: {
					name: defaults.appName
				},
				fields: [{
					name: `Choix :`,
					value: choiceList,
					inline: true
				}, {
					name: `Resultats :`,
					value: resultsList,
					inline: true
				}]
			};
	}

	return embed;
}

// const


// Function Message Action

function sendError(message, description) {
    message.channel.send({embed : {
        color: 15158332,
        description: ':x: ' + description
    }})
}

function sendpause (message, description) {
    message.channel.send({embed : {
        color: 15158332,
        description: ':pause_button: ' + description
    }})
}

function sendskip (message, description) {
    message.channel.send({embed : {
        color: 15158332,
        description: ':track_next:  ' + description
    }})
}

function sendresume (message, description) {
    message.channel.send({embed : {
        color: 15158332,
        description: ':arrow_forward:  ' + description
    }})
}

function sendstop (message, description) {
    message.channel.send({embed : {
        color: 15158332,
        description: ':stop_button:   ' + description
    }})
}

function sendpause (message, description) {
    message.channel.send({embed : {
        color: 15158332,
        description: ':pause_button: ' + description
    }})
}


clientDiscord.on('ready', function() {
    console.log("Je suis prêt !")
});


clientDiscord.on('message', message => {
    if(message.content === 'Yo') {
        message.reply('Heureux de te revoir parmis nous ( ͡° ͜ʖ ͡°)');
    }
    if(message.content === 'Heya') {
        message.reply('Heureux de te revoir parmis nous ( ͡° ͜ʖ ͡°)');
    }
if(message.content[0] === PREFIX) {
    let splitMessage = message.content.split(" ");
        if(splitMessage[0] === '!play')
            if(splitMessage.length === 2)
                {
                    if(message.member.voiceChannel)
                    {
                        message.member.voiceChannel.join().then(connection => {
                            dispatcher = connection.playStream(YTDL(splitMessage[1]));

                            dispatcher.on('error', e => {
                                console.log(e);
                            })

                            dispatcher.on('end', e => {
                                dispatcher = undefined;
                                console.log('Fin du son');
                            })
                        }).catch(cosole.log)
                    }
                    else 
                        sendError(message, "Erreur, Vous devez d'abord rejoindre un cannal vocal");
                }
            else
                sendError(message, "Erreur, problème dans les paramètres");

        else if(splitMessage[0] === '!pause')
            if(dispatcher !== undefined)
                dispatcher.pause();
                else 
                        sendpause(message, "La musique à été mise sur pause")

        else if(splitMessage[0] === '!resume')
            if(dispatcher !== undefined)
                dispatcher.resume();
                else 
                        sendresume(message, "La musique à été relancée")
        
        else if(splitMessage[0] === '!skip')
            if(dispatcher !== undefined)
                dispatcher.skip();
                else 
                        sendskip(message, "La musique à bien été Skip") 

        else if(splitMessage[0] === '!stop')
            if(dispatcher !== undefined)
                dispatcher.stop();
                else 
                        sendstop(message, "La musique à été arretée.")
                        


                        // Neg Project vote 
                        if(message.content) {
                            // Array with: anything in brackets, anything in quotes, anything separated by spaces (in that hierarchy)
                            var args = message.content.trim().match(/(?:[^\s"\[]+|\[[^\[]*\]|"[^"]*")+/g);
                            if(args[0].toLowerCase() === defaults.triggers.newPoll) {
                                args.shift();
                                // Do a little format checking to make sure (first argument, title, should be in quotes, and second argument, choices, should be in brackets)
                                if(
                                    args.length > 1 &&
                                    args[0].charAt(0) === '"' &&
                                    args[0].charAt(args[0].length - 1) === '"' &&
                                    args[1].charAt(0) === '[' &&
                                    args[1].charAt(args[1].length - 1) === ']'
                                ) {
                                    
                                    // Title of the poll, without quotes
                                    var title = args.shift().slice(1,-1);
                                    // Array of poll choices, trimmed
                                    var choices = args.shift().slice(1,-1).split(',').map(Function.prototype.call, String.prototype.trim);
                                    var options = {
                                        name: title,
                                        choices: choices,
                                        emojiType: 'letters',
                                        timeout: defaults.timeout,
                                        color: defaults.color,
                                        arguments: {},
                                        role: false,
                                        notes: '',
                                        server: message.guild
                                    };
                    
                                    // args should now just have the arguments
                                    args.forEach((arg, index) => {
                                        // If it's a new argument (starts with '--')
                                        if(arg.charAt(0) === '-' && arg.charAt(1) === '-') {
                    
                                            // Remove '--'
                                            arg = arg.slice(2);
                    
                                            if(arg === 'time' || arg === 'timeout') {
                                                let nextEl = args[index + 1];
                                                // If the next element is a nunber
                                                if(!isNaN(nextEl) && nextEl > 0) {
                                                    options.timeout = +nextEl;
                                                    args.slice(index + 1, 1);
                                                } else {
                                                    let errorMessage = `Un argument de délai d'attente a été trouvé, mais l'élément suivant n'est pas un nombre valide. Le sondage a par défaut la valeur ${defaults.timeout} minutes. `;
                                                    console.warn(errorMessage);
                                                    options.notes += errorMessage;
                                                }
                    
                                            } else if(arg === 'color' || arg === 'colour') {
                                                let nextEl = args[index + 1];
                                                // If the next element is a valid RGB int code
                                                if(!isNaN(nextEl) && +nextEl >= 0 && +nextEl <= 256*256*256) {
                                                    options.color = +nextEl;
                                                    args.slice(index + 1, 1);
                                                } else {
                                                    let errorMessage = `Un argument de couleur a été trouvé, mais l'élément suivant n'était pas un code RGB int. Cet élément a donc été ignoré.`;
                                                    console.warn(errorMessage);
                                                    options.notes += errorMessage;
                                                }
                    
                                            } else if(arg === 'role') {
                                                let nextEl = args[index + 1];
                                                // If the next element is surrounded by double quotes
                                                if(args.find(el => el == 'rxn' || el === 'reactions')) {
                                                    let errorMessage = `Un argument de "rôle" a été trouvé, mais l'option des réactions a été activée. Le vote ne peut donc pas être limité à des rôles.`;
                                                    console.warn(errorMessage);
                                                    footNote += errorMessage;
                                                } else if(nextEl.charAt(0) === '"' && nextEl.charAt(nextEl.length - 1) === '"') {
                                                    options.role = nextEl.slice(1, -1);
                                                    args.slice(index + 1, 1);
                                                } else {
                                                    let errorMessage = `Un argument "role" a été trouvé, mais l'élément suivant n'était pas une chaîne entourée de "guillemets", elle a donc été ignorée. `;
                                                    console.warn(errorMessage);
                                                    options.notes += errorMessage;
                                                }
                    
                                            } else if(arg === 'numbers' || arg === 'num') {
                                                if(choices.length <= emoji.numbers.length) {
                                                    options.emojiType = 'numbers';
                                                } else {
                                                    let errorMessage = `Le sondage devait être affiché avec des icônes numériques, mais il n’existe que dix icônes et ${choices.length} les options ont été spécifiées, donc ceci a été ignoré `;
                                                    console.warn(errorMessage);
                                                    options.notes += errorMessage;
                                                }
                    
                                            } else if(arg === 'yesno' || arg === 'yn') {
                                                if(choices.length <= emoji.yn.length) {
                                                    options.emojiType = 'yn';
                                                } else {
                                                    let errorMessage = `Le sondage a été demandé pour être affiché avec des icônes oui / non, mais trop de (${choices.length}) les options ont été spécifiées, donc ceci a été ignoré `;
                                                    console.warn(errorMessage);
                                                    options.notes += errorMessage;
                                                }
                    
                                            } else {
                                                options.arguments[arg] = true;
                                            }
                                        }
                                    });
                    
                                    var newPoll = new Poll(options);
                                    newPoll.startTimer();
                                    polls.set(newPoll.id, newPoll);
                    
                                    let embed = generateDiscordEmbed(newPoll, 'poll');
                                    message.channel.send('OK, voici votre sondage:', {embed});
                    
                                } else {
                                    console.error("Le format du message était invalide.");
                                    message.channel.send(`Les demandes de sondage doivent au minimum inclure un titre (entre guillemets) et un ensemble d'options (entre [crochets], séparés par des virgules). Par exemple, essayez \`${defaults.triggers.newPoll} "!sondage Question ? [Choix 1, Choix 2, Choix 3, etc..] \`.`);
                                }
                    
                            } else if(args[0].toLowerCase() == defaults.triggers.vote) {
                                args.shift();
                    
                                var activePollsInServer = [], voteResponse;
                                polls.forEach(poll => {
                                    if(poll.open && poll.server == message.guild) {
                                        activePollsInServer.push(poll.id);
                                    }
                                });
                    
                                if(activePollsInServer.length === 0) {
                                    voteResponse = `Il n'y a actuellement aucun sondage actif sur ce serveur, vous ne pouvez donc pas voter.`;
                    
                                } else if(args[0].charAt(0) !== '#') {
                                    // Only the vote was supplied
                                    if(activePollsInServer.length === 1) {
                                        voteResponse = polls.get(activePollsInServer[0]).vote(args[0].toLowerCase(), message.author).message;
                                    } else {
                                        // TODO dynamic examples
                                        voteResponse = "Désolé, ce n'est pas un sondage valide pour voter. Veuillez spécifier le numéro d'identification du sondage (ie \'!vote #1 A\') avant votre vote.";
                                    }
                    
                                } else {
                                    // The ID and vote were supplied
                                    let pollID = +(args[0].substr(1));
                    
                                    if(activePollsInServer.includes(pollID)) {
                                        voteResponse = polls.get(pollID).vote(args[1].toLowerCase(), message.author).message;
                                    } else {
                                        // TODO dynamic examples
                                        voteResponse = "Désolé, ce n'est pas un sondage valide pour voter. Veuillez spécifier le numéro d'identification du sondage (ie \'!vote #1 A\') avant votre vote.";
                                    }
                                 }
                    
                                 message.channel.send(voteResponse);
                    
                             } else if(args[0].toLowerCase() == defaults.triggers.results) {
                                 args.shift();
                    
                                 var response;
                    
                                 if(args[0].charAt(0) !== '#') { 
                                     message.channel.send('Error ! Paramètre invalide. Veuillez saisir une <valeur> correcte.');
                                 } else {
                                     let pollID = +(args[0].substr(1));
                    
                                     if(polls.get(pollID)) {
                                         let embed;
                                         if(args[1] && (args[1].slice(2) === 'detailed' || args[1].slice(2) === 'users')) {
                                             embed = generateDiscordEmbed(polls.get(pollID), 'détail des résultats');
                                         } else {
                                             embed = generateDiscordEmbed(polls.get(pollID), 'résultats');
                                         }
                                         
                                         message.channel.send('OK, voici les résultats:', {embed});
                                     } else {
                                         message.channel.send('Désolé, ce sondage ne semble pas exister.');
                                     }
                                 }
                    
                             } else if(args[0].toLowerCase() == '!pollping') {
                                 message.channel.send('PONG!'); //for testing connection
                             }
                        }
        

        //Commande Help pour voir la liste des commandes disponnibles
            if(message.content === "!help") {
                        let embed_help = new Discord.RichEmbed();
                            embed_help.setTitle('**#Commands List**')
                                        .setAuthor('Beast-Gang © 2018')
                                        .setColor('RANDOM')
                                        .setDescription ('Voici la liste des commandes disponibles.')
                                        .setFooter('Made by Neg & Mel')
                                        .setThumbnail('https://imgur.com/8TQ2MuE.png')
                                        .setTimestamp()
                                        .setURL('http://beast-gang.fr/')
                            
                            embed_help.addBlankField()
                                        .addField(":globe_with_meridians: __**Information**__ :globe_with_meridians:", "**!forum : ** Pour avoir le lien du Forum \n **!web : ** Pour avoir le lien du website \n **!candid :** Pour avoir le lien des candidatures", true)
                                        .addBlankField()
                                        .addField(":gear:  __**Serveurs**__ :gear: ", "**!sr8 :** Information concernant le serveur \n  **!jump :** Information concernant le serveur ")
                                        .addBlankField()
                                        .addField(":wrench:  __**Fun commands**__ :wrench:", "**!cpm :** Vous hésitez à faire un choix ? Cpm est fait pour vous \n **!mel :** Image correspondant aux délires de Mel \n **!troika :** Image correspondantes a risitas \n **!asuna :** Image correspondantes a asuna \n **!pepe :** Image correspondantes a pepe \n")
                                        .addBlankField()
                                        .addField(":pencil: __**Sondage**__ :pencil: ", "__**!sondage**__ : !sondage Question ? [Choix 1, Choix 2, Choix 3, etc..] \n __**!vote**__ : Répondre au sondage !vote choix \n __**!resultats**__ : Pour connaitre les résultats du sondage")
                                        .addBlankField()
                                        .addField(":musical_note:  __**Music**__ :musical_note:", "**!play :** Lire une musique \n **!pause :** Mettre une musique sur pause \n **!stop :** Arreter une musique \n **!skip :** Musique suivante \n **!resume :** Relancer après une pause")
                                        .addBlankField()
                                        
                            message.channel.send({embed: embed_help});
                                        }
                
        // commande pour afficher le forum 

            else if(message.content === "!forum") {
                    let embed_forum = new Discord.RichEmbed();
                        embed_forum.setTitle('**#Forum**')
                                .setAuthor('Beast-Gang © 2018')
                                .setColor('RANDOM')
                                .setDescription ('Voici le lien officiel du forum de le team **Beast-gang**')
                                .setFooter('Made by Neg')
                                .setImage('https://imgur.com/No8d0ay.jpg')
                                .setThumbnail('https://imgur.com/8TQ2MuE.png')
                                .setTimestamp()
                                .setURL('http://beast-gang.fr/forum/')
                    
                        embed_forum.addField("**Information** ", "Vous pouvez vous inscrire sur notre forum si ce n'est pas déjà le cas.", true)
                                .addBlankField()
                    
                        message.channel.send({embed: embed_forum});
                                }

        // commande pour afficher les candidatures

            else if(message.content === "!candid") {
                let embed_cand = new Discord.RichEmbed();
                    embed_cand.setTitle('**#Candidature**')
                                .setAuthor('Beast-Gang © 2018')
                                .setColor('RANDOM')
                                .setDescription ('Voici le lien officiel du forum de le team **Beast-gang**')
                                .setFooter('Made by Neg')
                                .setImage('https://imgur.com/No8d0ay.jpg')
                                .setThumbnail('https://imgur.com/8TQ2MuE.png')
                                .setTimestamp()
                                .setURL('https://beast-gang.fr/forum/viewforum.php?f=8&sid=1d3b5a2db3469070e3aa4948616caa7e')
                    
                    embed_cand.addField("**Information** ", "Vous pouvez consulter les candidatures en cours ou bien en poster une depuis ce lien.", true)
                                .addBlankField()
                    
                    message.channel.send({embed: embed_cand});
                                }

        // commande pour afficer le website

        else if(message.content === "!web") {
                        let embed_web= new Discord.RichEmbed();
                            embed_web.setTitle('**#Site Web**')
                                .setAuthor('Beast-Gang © 2018')
                                .setColor('RANDOM')
                                .setDescription ('Voici le lien officiel du website de le team **Beast-gang**')
                                .setFooter('Made by Neg')
                                .setImage('https://imgur.com/GaFTxda.jpg')
                                .setThumbnail('https://imgur.com/8TQ2MuE.png')
                                .setTimestamp()
                                .setURL('https://beast-gang.fr/')
                    
                            embed_web.addField("**Information** ", "Venez faire un tour sur le site de notre team. Vous y trouverez certaine information relative à nos serveur et autre.", true)
                                    .addBlankField()
                    
                                message.channel.send({embed: embed_web});
                                }

 
        
        else if(message.content === "!sr8") {
            let rich = new Discord.RichEmbed();
                rich.setTitle('**Bg* | sr8 [MOD]**')
                    .setAuthor('Beast-Gang © 2018')
                    .setColor('RANDOM')
                    .setDescription ('Vous pouvez retrouver quelque informations relative au serveur.')
                    .setFooter('Made by Neg')
                    .setImage('https://cache.gametracker.com/server_info/178.32.111.110:27960/b_560_95_1.png')
                    .setThumbnail('https://imgur.com/8TQ2MuE.png')
                    .setTimestamp()
                    .setURL('https://www.gametracker.com/server_info/178.32.111.110:27960/')
        
                    rich.addField("**L'ip du serveur:** ", "Vous pouvez utlisez directement la commande => /connect 178.32.111.110:27960 ", true)
                        .addBlankField()
                        .addField("**Joueur connecté:** ", "Vous pouvez trouver ci-dessous les personnes actuellement connectés sur le serveur", true)
        
                    message.channel.send({embed: rich});
                    }

        else if(message.content === "!jump") {
            let rich = new Discord.RichEmbed();
            rich.setTitle('**Bg* | Jump [MOD]**')
                .setAuthor('Beast-Gang © 2018')
                .setColor('RANDOM')
                .setDescription ('Vous pouvez retrouver quelque informations relative au serveur.')
                .setFooter('Made by Neg')
                .setImage('https://cache.gametracker.com/server_info/5.39.6.176:27960/b_560_95_1.png')
                .setThumbnail('https://imgur.com/8TQ2MuE.png')
                .setTimestamp()
                .setURL('https://www.gametracker.com/server_info/5.39.6.176:27960/')

                rich.addField("**L'ip du serveur:** ", "Vous pouvez utlisez directement la commande => /connect 5.39.6.176:27960 ", true)
                    .addBlankField()
                    .addField("**Joueur connecté:** ", "Vous pouvez trouver ci-dessous les personnes actuellement connectés sur le serveur", true)

                message.channel.send({embed: rich});
            }
        }

        // Commande  ( Random image about Chupa Chups (c) Mel <3  )
        if(message.content === "!mel") {
            let img_chu = [
                "https://images-ext-2.discordapp.net/external/s0rPT6M6fOh_UuknMP8tI5YNmRf1BVSNs-jLra3Usp0/%3Fv0.0.5/https/foreverchupa.fr/bundles/frontend/images/commun/s-right-2.png",
                "https://images-ext-2.discordapp.net/external/bVRD-xEvNPQJLx-KB74OqpLmLfWtC6KwC4L-O3F7Eok/%3Fv0.0.5/https/foreverchupa.fr/bundles/frontend/images/s-right.png",
                "https://upload.wikimedia.org/wikipedia/fr/thumb/d/d9/Chupa-chups.svg/1038px-Chupa-chups.svg.png",
                "http://miam-images.m.i.pic.centerblog.net/b6399759.png",
                "https://banner2.kisspng.com/20171216/bb0/chupa-chups-png-5a34bbc081aa90.7356837815134053765311.jpg",
                "http://chupachups.fr/chupachups/images/content/4-lollys.png",
            ]
            let rnd_chu = img_chu[Math.floor(Math.random() * img_chu.length)];

            let embed_chu = new Discord.RichEmbed();
            embed_chu.setTitle('**#Chupa Chups**')
                    .setAuthor('Beast-Gang © 2018')
                    .setColor('RANDOM')
                    .setFooter('Made by Neg & Mel')
                    .setImage(rnd_chu)
    
                message.channel.send({embed: embed_chu});
                }

        // Commande  ( Random image about Asuna x kirito)
        if(message.content === "!asuna") {
            let img_asu = [
                "https://pngimage.net/wp-content/uploads/2018/06/kirito-y-asuna-png.png",
                "https://data.whicdn.com/images/204357454/large.png",
                "https://dumielauxepices.net/sites/default/files/asuna-clipart-chubby-844417-923641.png",
                "https://pre00.deviantart.net/cccd/th/pre/f/2014/098/c/f/sword_art_online_asuna_png_by_missoverlays-d7dmd0v.png",
                "https://images3.alphacoders.com/791/thumb-350-791997.png",
            ]
            let rnd_asu = img_asu[Math.floor(Math.random() * img_asu.length)];

            let embed_asu = new Discord.RichEmbed();
            embed_asu.setTitle('**#Asuna X Kirito**')
                    .setAuthor('Beast-Gang © 2018')
                    .setColor('RANDOM')
                    .setFooter('Made by Neg & Mel')
                    .setImage(rnd_asu)
    
                message.channel.send({embed: embed_asu});
                }


        // Commande pepe ( Random image about pepe)
        if(message.content === "!pepe") {
            let img_pe = [
                "https://mbtskoudsalg.com/images/pepe-sad-png.png",
                "https://mbtskoudsalg.com/images/png-pepe-8.png",
                "https://c7.uihere.com/files/124/177/107/pepe-the-frog-internet-meme-kek-pol-meme-thumb.jpg",
                "https://risibank.fr/cache/stickers/d719/71989-full.png",
                "https://banner2.kisspng.com/20180410/eke/kisspng-pepe-the-frog-internet-meme-know-your-meme-frog-5acd2ccb596556.0788877115233957873662.jpg",
                "https://imgur.com/XZvjunB.png",
                
            ]
            let rnd_pe = img_pe[Math.floor(Math.random() * img_pe.length)];

            let embed_pe = new Discord.RichEmbed();
            embed_pe.setTitle('**#Pepe**')
                    .setAuthor('Beast-Gang © 2018')
                    .setColor('RANDOM')
                    .setFooter('Made by Neg & Mel')
                    .setImage(rnd_pe)
    
                message.channel.send({embed: embed_pe});
                }
               

        // Commande Risitas ( Random image about risitas )
        if(message.content === "!troika") {
            let img_ri = [
                "https://risibank.fr/cache/stickers/d299/29962-full.png",
                "http://i.imgur.com/Z14PGbr.png",
                "https://risibank.fr/cache/stickers/d87/8792-full.png",
                "https://risibank.fr/cache/stickers/d152/15285-full.png",
                "https://risibank.fr/cache/stickers/d191/19108-full.png",
                "https://i2.wp.com/image.noelshack.com/fichiers/2017/12/1490254840-16.png",
                "https://banner2.kisspng.com/20180630/cvr/kisspng-el-risitas-baguette-baker-thumb-bread-boulanger-5b378106167958.6658632415303641660921.jpg",
                "https://image.noelshack.com/fichiers/2017/19/1494341337-risitas-couteau1-ingenieurjvc.png",
                "https://image.noelshack.com/fichiers/2017/12/1490479268-3.png",
                "https://c7.uihere.com/files/382/97/98/el-risitas-issou-sticker-advertising-others-thumb.jpg",
                "https://banner2.kisspng.com/20180705/ahp/kisspng-el-risitas-popcorn-maize-junk-food-eating-fumer-5b3ed192eb8f54.4400914415308435389649.jpg",
                "https://banner2.kisspng.com/20180705/quv/kisspng-el-risitas-smoking-blunt-joint-cannabis-weed-joint-5b3e518d0e62e3.5710268715308107650589.jpg",
            ]
            let rnd_ri = img_ri[Math.floor(Math.random() * img_ri.length)];

            let embed_ri = new Discord.RichEmbed();
            embed_ri.setTitle('**#Risitas**')
                    .setAuthor('Beast-Gang © 2018')
                    .setColor('RANDOM')
                    .setFooter('Made by Neg & Mel')
                    .setImage(rnd_ri)
    
                message.channel.send({embed: embed_ri});
                }

        if(message.content === "!cpm") {
            let ab = [
                "https://imgur.com/2ADDhpx.png",
                "https://imgur.com/ss7fdg6.png",
                "https://imgur.com/2ADDhpx.png",
            ]
            let mel = ab[Math.floor(Math.random() * ab.length)];

            let neg = new Discord.RichEmbed();
            neg.setTitle('**#Choisi Pour Moi**')
                .setAuthor('Beast-Gang © 2018')
                .setColor('RANDOM')
                .setFooter('Made by Neg')
                .setImage(mel)
                .setThumbnail('https://imgur.com/8TQ2MuE.png')
                .setTimestamp()
    
                neg.addField("**CPM :** ", "Vous n'arrivez pas à vous décider entre 2 choix ? Ne vous en faite pas ! CPM est la pour vous aidez à faire le bon choix. :sunglasses: :ok_hand:", true)
                    .addBlankField()
                    .addField("**Mon choix :** ", "Voici la réponse à la question qui vous posez tant problème ! :joy:", true)
    
                message.channel.send({embed: neg});
                }

        
            }

        

        

);


clientDiscord.on('guildMemberAdd', member => {
    member.createDM().then(channel =>{
        return channel.send('Bienvenue sur le serveur Beast-Gang ' + member.displayName);
    }).catch(console.error)
})

clientDiscord.on('guildMemberAdd', member => {
    member.createDM().then(channel =>{
        return channel.send("C'est dommage que tu nous quittes, en espérant te revoir prochaine" + member.displayName);
    }).catch(console.error)
})

clientDiscord.login('YOURTOKEN') // Token
