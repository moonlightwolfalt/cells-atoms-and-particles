# frozen_string_literal: true

require 'json'

module IslandForge
  # Catalogs shared with the TypeScript core (regenerate with `npm run schema`).
  module Catalog
    DATA_DIR = File.expand_path('../../data', __dir__)

    def self.load(name)
      JSON.parse(File.read(File.join(DATA_DIR, name)))
    end

    MODES = load('modes.json').to_h { |m| [m['id'], m] }.freeze
    DEVICES = load('devices.json').to_h { |d| [d['id'], d] }.freeze
    FEATURE_TYPES = load('feature-types.json').freeze
    MAP_SCHEMA = load('island-map.schema.json').freeze
    # Fortnite Creative catalog: prefabs, galleries, chests, items, vehicles, creatures.
    CATALOG = load('catalog.json').freeze
    CATALOG_IDS = CATALOG.values.flatten.to_h { |e| [e['id'], e] }.freeze

    def self.search(kind, query = '')
      entries = CATALOG.fetch(kind) { raise ArgumentError, "Unknown catalog #{kind.inspect}. Known: #{CATALOG.keys.join(', ')}" }
      q = query.to_s.downcase
      entries.select { |e| q.empty? || "#{e['name']} #{e['category']} #{e['tags'].join(' ')} #{e['description']}".downcase.include?(q) }
    end

    def self.name_of(id) = CATALOG_IDS.dig(id, 'name') || id

    def self.mode(id)
      MODES.fetch(id) { raise ArgumentError, "Unknown mode #{id.inspect}. Known: #{MODES.keys.sort.join(', ')}" }
    end

    def self.modes_by_category
      MODES.values.group_by { |m| m['category'] }
    end
  end
end
