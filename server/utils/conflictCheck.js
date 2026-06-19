const Lead = require('../models/Lead');
const Client = require('../models/Client');
const Matter = require('../models/Matter');

async function runConflictCheck(opposingPartyName) {
  if (!opposingPartyName || !opposingPartyName.trim()) {
    return { hasConflict: false, conflictDetails: [] };
  }

  const searchName = opposingPartyName.trim().toLowerCase();
  const conflicts = [];

  const matchingLeads = await Lead.find({
    $or: [
      { firstName: { $regex: searchName, $options: 'i' } },
      { lastName: { $regex: searchName, $options: 'i' } },
      { opposingPartyName: { $regex: searchName, $options: 'i' } }
    ]
  }).select('firstName lastName opposingPartyName status');

  matchingLeads.forEach(lead => {
    const fullName = `${lead.firstName} ${lead.lastName}`;
    if (fullName.toLowerCase().includes(searchName)) {
      conflicts.push(`Name matches existing lead: ${fullName} (Status: ${lead.status})`);
    }
    if (lead.opposingPartyName && lead.opposingPartyName.toLowerCase().includes(searchName)) {
      conflicts.push(`Name matches opposing party on lead: ${fullName}`);
    }
  });

  const matchingClients = await Client.find({
    $or: [
      { firstName: { $regex: searchName, $options: 'i' } },
      { lastName: { $regex: searchName, $options: 'i' } },
      { company: { $regex: searchName, $options: 'i' } }
    ]
  }).select('firstName lastName company');

  matchingClients.forEach(client => {
    const fullName = `${client.firstName} ${client.lastName}`;
    conflicts.push(`Name matches existing client: ${fullName}${client.company ? ` (${client.company})` : ''}`);
  });

  const matchingMatters = await Matter.find({
    $or: [
      { opposingParty: { $regex: searchName, $options: 'i' } },
      { opposingCounsel: { $regex: searchName, $options: 'i' } }
    ]
  }).select('name opposingParty opposingCounsel');

  matchingMatters.forEach(matter => {
    if (matter.opposingParty && matter.opposingParty.toLowerCase().includes(searchName)) {
      conflicts.push(`Name matches opposing party on matter: ${matter.name}`);
    }
    if (matter.opposingCounsel && matter.opposingCounsel.toLowerCase().includes(searchName)) {
      conflicts.push(`Name matches opposing counsel on matter: ${matter.name}`);
    }
  });

  return {
    hasConflict: conflicts.length > 0,
    conflictDetails: conflicts
  };
}

module.exports = { runConflictCheck };
