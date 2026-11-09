# frozen_string_literal: true

require 'json'
require 'csv'

module IslandForge
  # A map spec as exported by the web app / server.
  class Spec
    CM_PER_M = 100
    MAX_ELEVATION_CM = 6000
    REQUIRED = {
      'format' => String, 'mode' => String, 'name' => String, 'map_size_m' => Numeric, 'pois' => Array,
      'features' => Array, 'storm' => Hash, 'rules' => Hash, 'publish' => Hash, 'devices' => Array
    }.freeze

    attr_reader :data

    def self.load(path)
      path = File.join(path, 'map-spec.json') if File.directory?(path)
      new(JSON.parse(File.read(path)))
    end

    def initialize(data)
      @data = data
    end

    def [](key) = @data[key]
    def name = @data['name']
    def mode = Catalog::MODES[@data['mode']]
    def to_json(*args) = JSON.pretty_generate(@data, *args)

    def save(path)
      File.write(path, "#{to_json}\n")
      path
    end

    # Returns an array of problems; empty means the spec is usable.
    def problems
      out = REQUIRED.filter_map do |key, kind|
        if !@data.key?(key) then "missing '#{key}'"
        elsif !@data[key].is_a?(kind) then "'#{key}' has the wrong type"
        end
      end
      return out unless out.empty?

      out << "unknown mode #{@data['mode'].inspect}" unless mode
      out << 'needs at least one location' if @data['pois'].empty?
      @data['pois'].each_with_index { |p, i| out.concat(range_problems(p, "pois[#{i}]")) }
      @data['features'].each_with_index do |f, i|
        out.concat(range_problems(f, "features[#{i}]"))
        out << "features[#{i}]: unknown type #{f['type'].inspect}" unless Catalog::FEATURE_TYPES.include?(f['type'])
      end
      @data['devices'].each_with_index do |d, i|
        out << "devices[#{i}]: unknown device #{d['device'].inspect}" unless Catalog::DEVICES.key?(d['device'])
      end
      (@data['loot'] || {}).each do |key, ids|
        ids.each { |id| out << "loot.#{key}: unknown id #{id.inspect}" unless Catalog::CATALOG_IDS.key?(id) || id.start_with?('custom_') }
      end
      radii = @data['storm'].fetch('phases', []).map { |p| p['end_radius_pct'] }
      out << 'storm phases must shrink' unless radii == radii.sort.reverse
      out
    end

    def valid? = problems.empty?

    private def range_problems(item, label)
      %w[x y].filter_map do |axis|
        v = item[axis]
        "#{label}: #{axis} must be between 0 and 1" unless v.is_a?(Numeric) && v.between?(0, 1)
      end
    end

    # 0..1 map coordinates -> UEFN centimetres around the island centre (+X north, +Y east).
    def to_world(x, y, elevation = 0)
      size_cm = @data['map_size_m'] * CM_PER_M
      [(-(y - 0.5) * size_cm).round, ((x - 0.5) * size_cm).round, (elevation * MAX_ELEVATION_CM).round]
    end

    def self.grid_ref(x, y)
      "#{'ABCDEFGHIJ'[(x * 10).floor.clamp(0, 9)]}#{((y * 10).floor + 1).clamp(1, 10)}"
    end

    def markers
      pois = @data['pois'].map do |p|
        x, y, z = to_world(p['x'], p['y'], p['elevation'] || 0)
        { label: p['name'], category: 'poi', grid: Spec.grid_ref(p['x'], p['y']), x: x, y: y, z: z }
      end
      features = @data['features'].map do |f|
        x, y, z = to_world(f['x'], f['y'])
        { label: f['type'], category: f['type'], grid: Spec.grid_ref(f['x'], f['y']), x: x, y: y, z: z }
      end
      pois + features
    end

    def markers_csv
      CSV.generate do |csv|
        csv << %w[label category grid X Y Z]
        markers.each { |m| csv << m.values_at(:label, :category, :grid, :x, :y, :z) }
      end
    end

    def devices_csv
      CSV.generate do |csv|
        csv << %w[id device label grid X Y settings]
        @data['devices'].select { |d| d.fetch('enabled', true) }.each do |d|
          x, y, = to_world(d['x'], d['y'])
          settings = d['settings'].map { |k, v| "#{k}=#{v}" }.join('; ')
          csv << [d['id'], Catalog::DEVICES.dig(d['device'], 'name') || d['device'], d['label'], Spec.grid_ref(d['x'], d['y']), x, y, settings]
        end
      end
    end

    def summary
      {
        name: name,
        mode: mode ? mode['label'] : @data['mode'],
        category: mode && mode['category'],
        map_size_m: @data['map_size_m'],
        players: @data['rules']['max_players'],
        locations: @data['pois'].map { |p| p['name'] },
        features: @data['features'].map { |f| f['type'] }.tally,
        devices: @data['devices'].select { |d| d.fetch('enabled', true) }.map { |d| d['device'] }.tally,
        storm_phases: @data['storm'].fetch('phases', []).size,
        verse_modules: mode ? mode['verse'] : [],
        tags: @data['publish']['tags'],
        builds: @data['pois'].to_h { |p| [p['name'], { prefab: p['prefab'].to_s.empty? ? nil : Catalog.name_of(p['prefab']), extra_prefabs: Array(p['extra_prefabs']).map { |x| Catalog.name_of(x) }, galleries: Array(p['galleries']).map { |g| Catalog.name_of(g) } }] },
        loot: (@data['loot'] || {}).transform_values { |ids| ids.map { |i| Catalog.name_of(i) } }
      }
    end
  end
end
