# frozen_string_literal: true

require 'minitest/autorun'
require 'socket'
require 'json'
require 'tmpdir'
require_relative '../lib/island_forge'

FIXTURES = File.join(__dir__, 'fixtures')

class TestSpec < Minitest::Test
  def specs = %w[reload tycoon capture_the_flag].map { |m| IslandForge::Spec.load(File.join(FIXTURES, "#{m}.json")) }

  def test_catalogs
    assert_operator IslandForge::Catalog::MODES.size, :>=, 30
    assert_operator IslandForge::Catalog::DEVICES.size, :>=, 75
    assert_raises(ArgumentError) { IslandForge::Catalog.mode('nope') }
  end

  def test_fixtures_are_valid
    specs.each { |s| assert_empty s.problems, s.name }
  end

  def test_problems_detected
    data = JSON.parse(File.read(File.join(FIXTURES, 'reload.json')))
    data['pois'][0]['x'] = 4
    data['features'] << { 'type' => 'spaceship', 'x' => 0.5, 'y' => 0.5 }
    problems = IslandForge::Spec.new(data).problems
    assert(problems.any? { |p| p.include?('x must be between 0 and 1') })
    assert(problems.any? { |p| p.include?('unknown type "spaceship"') })
    assert_includes IslandForge::Spec.new({}).problems, "missing 'pois'"
  end

  def test_world_coordinates_and_markers
    s = specs.first
    assert_equal [0, 0, 0], s.to_world(0.5, 0.5)
    half = s['map_size_m'] * 50
    assert_equal [half, half, 0], s.to_world(1, 0)
    assert_equal s['pois'].size + s['features'].size, s.markers.size
    assert s.markers_csv.start_with?("label,category,grid,X,Y,Z\n")
    assert_equal s['devices'].count { |d| d['enabled'] } + 1, s.devices_csv.lines.size
  end

  def test_catalog_and_builds
    assert_operator IslandForge::Catalog::CATALOG['prefabs'].size, :>=, 100
    assert(IslandForge::Catalog.search('vehicles', 'boat').any? { |e| e['id'] == 'motorboat' })
    s = specs.first
    assert_equal s['pois'].map { |p| p['name'] }.sort, s.summary[:builds].keys.sort
    data = JSON.parse(File.read(File.join(FIXTURES, 'reload.json')))
    data['loot']['pool'] << 'it_laser_sword'
    data['loot']['chests'] << 'custom_new_chest'
    problems = IslandForge::Spec.new(data).problems
    assert_includes problems, 'loot.pool: unknown id "it_laser_sword"'
    refute(problems.any? { |p| p.include?('custom_new_chest') })
  end

  def test_summary
    s = specs[1]
    sum = s.summary
    assert_equal 'Tycoon', sum[:mode]
    assert_equal s['pois'].map { |p| p['name'] }, sum[:locations]
    assert_includes sum[:verse_modules], 'tycoon_economy'
  end
end

# A tiny HTTP server that pretends to be the Island Forge API.
class FakeServer
  attr_reader :url

  def initialize(spec)
    @server = TCPServer.new('127.0.0.1', 0)
    @url = "http://127.0.0.1:#{@server.addr[1]}"
    @thread = Thread.new do
      loop do
        client = @server.accept
        line = client.gets
        headers = {}
        while (h = client.gets) && h != "\r\n"
          k, v = h.split(':', 2)
          headers[k.downcase] = v.strip
        end
        body = headers['content-length'] ? client.read(headers['content-length'].to_i) : ''
        path = line.split[1]
        status, type, out = respond(path, body.empty? ? {} : JSON.parse(body), spec)
        client.write "HTTP/1.1 #{status}\r\ncontent-type: #{type}\r\ncontent-length: #{out.bytesize}\r\nconnection: close\r\n\r\n#{out}"
        client.close
      rescue IOError
        break
      end
    end
  end

  def respond(path, body, spec)
    case path
    when '/api/generate'
      return [400, 'application/json', { error: 'Add your Anthropic API key' }.to_json] if body['provider'] == 'anthropic'

      [200, 'application/json', { spec: spec.merge('mode' => body['mode']) }.to_json]
    when '/api/verse' then [200, 'application/json', { files: [{ path: 'a.verse', code: '# hi' }] }.to_json]
    when '/api/package' then [200, 'application/zip', "PK\x05\x06#{"\0" * 18}"]
    else [200, 'application/json', { providers: [{ id: 'offline' }] }.to_json]
    end
  end

  def stop
    @server.close
    @thread.kill
  end
end

class TestClient < Minitest::Test
  def setup
    @fake = FakeServer.new(JSON.parse(File.read(File.join(FIXTURES, 'reload.json'))))
    @client = IslandForge::Client.new(@fake.url)
  end

  def teardown = @fake.stop

  def test_round_trip
    assert_equal 'offline', @client.providers['providers'][0]['id']
    spec = @client.generate('ice', mode: 'blitz', provider: 'offline')
    assert_equal 'blitz', spec['mode']
    assert_equal '# hi', @client.verse(spec).first['code']
    assert @client.package(spec).start_with?('PK')
  end

  def test_error_status
    err = assert_raises(IslandForge::Error) { @client.generate('ice') }
    assert_equal 400, err.status
    assert_match(/API key/, err.message)
  end

  def test_unreachable
    err = assert_raises(IslandForge::Error) { IslandForge::Client.new('http://127.0.0.1:9').providers }
    assert_match(/Could not reach/, err.message)
  end

  def test_against_real_server
    skip 'set ISLAND_FORGE_SERVER to run' unless ENV['ISLAND_FORGE_SERVER']
    client = IslandForge::Client.new(ENV['ISLAND_FORGE_SERVER'])
    spec = client.generate('candy factory', mode: 'simulator', provider: 'offline')
    assert spec.valid?, spec.problems.join(', ')
    assert(client.verse(spec).all? { |f| f['path'].end_with?('.verse') })
    assert client.package(spec).start_with?('PK')
  end
end
