import type { Person } from './types.ts';

export function defaultPeople(now = Date.now()): Person[] {
  return [
    { id: 'person-me', name: '我', createdAt: now },
    { id: 'person-spouse', name: '伴侣', createdAt: now },
    { id: 'person-child', name: '孩子', createdAt: now },
    { id: 'person-parents', name: '父母', createdAt: now },
  ];
}

export function personName(people: Person[], id: string): string {
  return people.find((person) => person.id === id)?.name ?? '';
}
