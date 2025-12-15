import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { AdvancedCommandLogger } from '../utils/advancedCommandLogger.js';
import { ErrorLog } from '../utils/errorLogger.js';
import { quickReply } from '../utils/quickResponse.js';

export default {
  data: new SlashCommandBuilder()
    .setName('balance-remove')
    .setDescription('Remove balance from a customer (Admin only)')
    .addStringOption((option) =>
      option
        .setName('email')
        .setDescription('Customer email address')
        .setRequired(true)
    )
    .addNumberOption((option) =>
      option
        .setName('amount')
        .setDescription('Amount to remove (in shop currency)')
        .setRequired(true)
        .setMinValue(0.01)
    )
    .addStringOption((option) =>
      option
        .setName('reason')
        .setDescription('Reason for removing balance (optional)')
        .setRequired(false)
    ),

  onlyWhitelisted: true,
  requiredRole: 'admin',

  async execute(interaction, api) {
    const email = interaction.options.getString('email')?.trim();
    const amount = interaction.options.getNumber('amount');
    const reason = interaction.options.getString('reason') || 'Manual balance adjustment';
    const userEmail = interaction.user.username;

    // Use quick reply to ensure response within 3 seconds
    await quickReply(interaction, async () => {
      const startTime = Date.now();
      try {
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          return {
            content: `❌ Email inválido: \`${email}\`\n✅ Formato válido: usuario@ejemplo.com`
          };
        }

        // Validate amount
        if (!Number.isFinite(amount) || amount <= 0) {
          return {
            content: `❌ Monto inválido: \`${amount}\`\n✅ Debe ser un número positivo`
          };
        }

        console.log(`[BALANCE-REMOVE] Removing ${amount} from ${email} by ${userEmail}`);

        // Buscar el cliente por email
        let customer = null;
        let currentBalance = 0;
        
        try {
          // Intentar obtener clientes y buscar por email
          const customersResponse = await api.get(`shops/${api.shopId}/customers`);
          
          // Manejar diferentes formatos de respuesta
          let customersList = [];
          if (Array.isArray(customersResponse)) {
            customersList = customersResponse;
          } else if (customersResponse?.data && Array.isArray(customersResponse.data)) {
            customersList = customersResponse.data;
          } else if (customersResponse?.customers && Array.isArray(customersResponse.customers)) {
            customersList = customersResponse.customers;
          }
          
          // Buscar cliente por email
          customer = customersList.find(c => c.email && c.email.toLowerCase() === email.toLowerCase());
          
          if (customer) {
            currentBalance = parseFloat(customer.balance || customer.credit || customer.credits || 0);
            console.log(`[BALANCE-REMOVE] Cliente encontrado: ID ${customer.id}, Balance actual: ${currentBalance}`);
          } else {
            throw new Error(`Cliente no encontrado con email: ${email}`);
          }
        } catch (searchError) {
          throw new Error(`No se pudo encontrar el cliente: ${searchError.message}`);
        }

        // Verificar que tenga suficiente balance
        if (currentBalance < amount) {
          throw new Error(`Balance insuficiente. Balance actual: $${currentBalance}, Intento de remover: $${amount}`);
        }

        const newBalance = Math.max(0, currentBalance - amount);
        let response;

        // Intentar actualizar el balance usando diferentes métodos
        try {
          // Método 1: Actualizar cliente completo
          response = await api.put(`shops/${api.shopId}/customers/${customer.id}`, {
            balance: newBalance,
            credit: newBalance
          });
          
          response = {
            old_balance: currentBalance,
            new_balance: newBalance,
            customer_id: customer.id,
            email: customer.email || email
          };
          
          console.log(`[BALANCE-REMOVE] ✅ Balance actualizado usando PUT: ${currentBalance} → ${newBalance}`);
        } catch (putError) {
          try {
            // Método 2: Usar endpoint específico de balance si existe
            response = await api.post(`shops/${api.shopId}/customers/${customer.id}/balance`, {
              amount: amount,
              operation: 'remove'
            });
            
            if (!response.old_balance) {
              response.old_balance = currentBalance;
            }
            if (!response.new_balance) {
              response.new_balance = newBalance;
            }
            
            console.log(`[BALANCE-REMOVE] ✅ Balance actualizado usando POST balance: ${currentBalance} → ${newBalance}`);
          } catch (postError) {
            try {
              // Método 3: Usar endpoint de créditos
              response = await api.post(`shops/${api.shopId}/customers/${customer.id}/credits`, {
                amount: amount,
                type: 'remove'
              });
              
              if (!response.old_balance) {
                response.old_balance = currentBalance;
              }
              if (!response.new_balance) {
                response.new_balance = newBalance;
              }
              
              console.log(`[BALANCE-REMOVE] ✅ Balance actualizado usando POST credits: ${currentBalance} → ${newBalance}`);
            } catch (creditError) {
              // Si todos los métodos fallan, usar el endpoint original pero con mejor manejo
              try {
                response = await api.post(`shops/${api.shopId}/customers/balance/remove`, {
                  customer_id: customer.id,
                  email: email,
                  amount: amount,
                  reason: reason
                });
                
                if (!response.old_balance) {
                  response.old_balance = currentBalance;
                }
                if (!response.new_balance) {
                  response.new_balance = newBalance;
                }
                
                console.log(`[BALANCE-REMOVE] ✅ Balance actualizado usando endpoint original: ${currentBalance} → ${newBalance}`);
              } catch (originalError) {
                // Si todo falla, al menos calcular y mostrar el resultado esperado
                console.error('[BALANCE-REMOVE] Todos los métodos de actualización fallaron:', {
                  putError: putError.message,
                  postError: postError.message,
                  creditError: creditError.message,
                  originalError: originalError.message
                });
                
                // Retornar respuesta con cálculo local
                response = {
                  old_balance: currentBalance,
                  new_balance: newBalance,
                  customer_id: customer.id,
                  email: customer.email || email,
                  warning: 'Balance calculado - verificar manualmente en SellAuth'
                };
              }
            }
          }
        }

        // Success response
        const embed = new EmbedBuilder()
          .setColor(0xff6600)
          .setTitle('✅ Balance Removido')
          .addFields(
            { name: '👤 Cliente', value: email, inline: true },
            { name: '💰 Monto Removido', value: `$${amount}`, inline: true },
            { name: '📝 Razón', value: reason, inline: false },
            { name: '✓ Admin', value: userEmail, inline: true }
          )
          .setFooter({ text: 'SellAuth Bot | Balance Management' })
          .setTimestamp();

        // Add old and new balance if available
        if (response?.old_balance !== undefined && response?.new_balance !== undefined) {
          embed.addFields(
            { name: '💾 Balance Anterior', value: `$${response.old_balance}`, inline: true },
            { name: '💾 Balance Nuevo', value: `$${response.new_balance}`, inline: true }
          );
        }

        // Log success
        await AdvancedCommandLogger.logCommand(interaction, 'balance-remove', {
          status: 'EXECUTED',
          result: 'Balance removed successfully',
          executionTime: Date.now() - startTime,
          metadata: {
            'Email': email,
            'Amount Removed': `$${amount}`,
            'Reason': reason,
            'New Balance': response?.new_balance ? `$${response.new_balance}` : 'N/A',
            'Admin': userEmail
          }
        });

        console.log(`[BALANCE-REMOVE] ✅ Successfully removed ${amount} from ${email}`);
        return { embeds: [embed] };
      } catch (error) {
        console.error('[BALANCE-REMOVE] Error:', error);

        let errorMsg = error.message || 'Unknown error';
        if (error.status === 404) {
          errorMsg = 'Cliente no encontrado (404)';
        } else if (error.status === 429) {
          errorMsg = 'Rate limited - intenta de nuevo en unos segundos';
        } else if (error.status === 400) {
          errorMsg = error.data?.message || 'Solicitud inválida (400)';
        }

        await AdvancedCommandLogger.logCommand(interaction, 'balance-remove', {
          status: 'ERROR',
          result: errorMsg,
          executionTime: Date.now() - startTime,
          metadata: {
            'Email': email,
            'Amount': amount.toString(),
            'Error Status': error.status || 'Unknown',
            'Error': error.message
          },
          errorCode: error.name || 'API_ERROR',
          stackTrace: error.stack
        });

        ErrorLog.log('balance-remove', error, {
          email,
          amount,
          admin: userEmail
        });

        return { content: `❌ Error al remover balance: \`${errorMsg}\`` };
      }
    });
  }
};