# -*- mode: ruby -*-
# vi: set ft=ruby :

# Vagrantfile API/syntax version. Don't touch unless you know what you're doing!
VAGRANTFILE_API_VERSION = "2"
NODE_NAME = "eureka-sidecar.vagrant"

# Change these settings to something unique for your
# service so they don't conflict with other vagrant boxes
MACHINE_ADDR = "192.168.100.30"
MACHINE_SSH_PORT = 2230
MACHINE_WEB_PORT = 44330

Vagrant.configure(VAGRANTFILE_API_VERSION) do |config|

  config.vm.box = "ubuntu/trusty64"
  config.vm.synced_folder ".", "/home/vagrant/eureka-sidecar/"

  config.vm.define 'eureka-sidecar' do |config|
    config.ssh.port = MACHINE_SSH_PORT

    config.vm.hostname = NODE_NAME
    config.vm.network "private_network", ip: MACHINE_ADDR
    config.vm.network :forwarded_port, guest: 22, host: MACHINE_SSH_PORT
    config.vm.network :forwarded_port, guest: 443, host: MACHINE_WEB_PORT

    config.vm.provider :virtualbox do |vb|
      vb.gui = false
      vb.customize ['modifyvm', :id, '--memory', '512']
      vb.customize ['modifyvm', :id, '--name',   NODE_NAME ]
    end
    
    config.vm.provision "ansible" do |ansible|
      ansible.playbook       = "playbooks/vagrant.yml"
      ansible.extra_vars     = "playbooks/roles/vagrant/vars/main.yml"
      ansible.verbose        = "vv"
      ansible.vault_password_file = "~/.vault.pass.txt"
    end

  end

end
